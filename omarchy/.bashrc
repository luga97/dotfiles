# If not running interactively, don't do anything
[[ $- != *i* ]] && return

# Source omarchy defaults
source ~/.local/share/omarchy/default/bash/rc

# Source user customizations
source ~/.bash_customizations
