#!/usr/bin/env python3
"""Configure private dashboard HTTPS with a password received through a private file."""

import argparse
import base64
import hashlib
import http.cookiejar
import json
from pathlib import Path
import secrets
import shlex
import subprocess
import sys
import time
import urllib.error
import urllib.request


WRITER = r'''
import json, os, subprocess, sys
from pathlib import Path
data = json.load(sys.stdin)
hermes = str(Path.home()/'.local/bin/hermes')
updates = {
    'dashboard.basic_auth.username': data['username'],
    'dashboard.basic_auth.password_hash': data['password_hash'],
    'dashboard.basic_auth.secret': data['signing_secret'],
    'dashboard.public_url': data['url'],
}
for key, value in updates.items():
    result = subprocess.run([hermes, 'config', 'set', key, value],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if result.returncode:
        print('Could not configure dashboard field: '+key, file=sys.stderr)
        sys.exit(1)
os.chmod(Path.home()/'.hermes/config.yaml', 0o600)
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--password-file', required=True)
    parser.add_argument('--host', default='home-server')
    parser.add_argument('--username', default='luis')
    args = parser.parse_args()
    password = Path(args.password_file).read_text()
    if not password:
        raise ValueError('The private password file is empty')
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1, dklen=32)
    password_hash = 'scrypt$16384$8$1$'+base64.b64encode(salt).decode()+'$'+base64.b64encode(digest).decode()
    url = 'https://archlinux.tail27d0f2.ts.net:8443'
    payload = {'username': args.username, 'password_hash': password_hash,
               'signing_secret': secrets.token_hex(32), 'url': url}
    done = subprocess.run(['ssh', '-o', 'BatchMode=yes', args.host,
                           shlex.join(['/usr/bin/python3', '-c', WRITER])],
                          input=json.dumps(payload), text=True, capture_output=True, timeout=120)
    if done.returncode:
        raise RuntimeError('Dashboard configuration failed; credential values were not logged')
    command = ('systemctl --user restart hermes-dashboard.service && '
               'sudo -n tailscale serve --bg --https=8443 --yes http://127.0.0.1:9119')
    done = subprocess.run(['ssh', '-o', 'BatchMode=yes', args.host, command],
                          capture_output=True, text=True, timeout=90)
    if done.returncode:
        raise RuntimeError('Could not start dashboard or private Tailscale Serve')
    # Read-only reachability checks with a bounded startup retry.
    for attempt in range(10):
        try:
            with urllib.request.urlopen(url+'/api/status', timeout=10) as response:
                status = json.load(response)
            break
        except (OSError, urllib.error.URLError):
            if attempt == 9:
                raise RuntimeError('HTTPS endpoint did not become ready') from None
            time.sleep(2)
    if not status.get('auth_required') or 'basic' not in status.get('auth_providers', []):
        raise RuntimeError('Dashboard did not advertise the required login gate')
    try:
        urllib.request.urlopen(url+'/api/auth/me', timeout=10)
    except urllib.error.HTTPError as error:
        if error.code not in (401, 403):
            raise RuntimeError('Unexpected response for unauthenticated API request') from None
    else:
        raise RuntimeError('Unauthenticated identity request was not rejected')
    cookies = http.cookiejar.CookieJar()
    client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))
    login = urllib.request.Request(url+'/auth/password-login',
        data=json.dumps({'provider':'basic', 'username':args.username, 'password':password}).encode(),
        headers={'Content-Type':'application/json', 'Origin':url}, method='POST')
    with client.open(login, timeout=15) as response:
        if response.status != 200:
            raise RuntimeError('Password sign-in did not succeed')
    with client.open(url+'/api/auth/me', timeout=10) as response:
        identity = json.load(response)
    print(json.dumps({'url':url, 'username':args.username, 'auth_required':True,
                      'login_verified':True, 'identity_provider':identity.get('provider')}))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
        # Never print subprocess arguments, request bodies, hashes or cookies.
        print(type(error).__name__+': '+str(error), file=sys.stderr)
        sys.exit(1)
