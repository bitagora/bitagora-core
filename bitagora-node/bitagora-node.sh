#!/usr/bin/env bash
#
#
# BITAGORA NODE
# bitagora-node.sh
# Installation and monitoring script for Bitagora validator nodes
# Developed by Ignasi Ribó, 2018
# Repo: https://github.com/bitagora/bitagora-core
# 
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ------------------------------------------------------------------------------
#

# Constants
current_dir=`pwd`
cl=$(( $(tput cols) / 3 ))
option_row=0
QUITMSG="Thank you for supporting democracy. Goodbye."
normal="\\033[0;39m"
green="\\033[1;32m"
cyan="\\033[1;36m"
bwhite="\\033[1;37m"
bblack="\\033[40m"
bred="\\033[41m"
bgreen="\\033[42m"
bblue="\\033[44m"
bcyan="\\033[46m"

# UI functions

function printline {
	c=$1
    printf "%$(tput cols)s\n" "" | sed s/' '/"${c:=_}"/g
}

function printTitle {
	cols=$(tput cols)
	line1=$MUI_TITLE
	line2=`echo $1 | tr '[:lower:]' '[:upper:]'`
	printf "\\033[44m""%$(tput cols)s" ""
	tput cup 0 0; echo -e "$bcyan"" + ""$bblue"
	tput cup 0 $(($cols-3)); echo -e "$bcyan"" + ""$bblue" 
	tput cup 0 $((($cols-${#line1})/2))
	echo -e "$cyan""$line1"$normal
	printf "$bblue""$bwhite""%$(tput cols)s" ""
	tput cup 1 $((($cols-${#line2})/2))
	echo -e "$line2""$normal"
	echo
}

function printOption {
	cols=$(tput cols)
	case "$1" in
		"desc" )
			col1="$2  ""$green""$3""$normal"
			echo -ne " $col1"		
			if [[ "x$4" != "x" ]]; then
				# Affiche la description
				tput cuf $((39-${#col1}))
				echo -e " $4"
			else
				echo
			fi
			echo -e "\\033[34m"`printline —`"$normal"
			return
		break;;
		"result" )
			if [[ $option_row -eq 0 ]]; then
				row_color=""
				option_row=1
			else
				row_color="$bblue"
				option_row=0
			fi
			col1=" $2"
			result="$3 "
			tput sc 
			printf "$row_color""%$(tput cols)s" ""
			tput rc
			echo -ne "$row_color""$col1"
			tput cuf $(($cols-${#col1}-${#result}))
			echo -e "$cyan""$result""$normal"
			return
		break;;
		* ) return ;;
	esac
}

function input {
	echo -ne " ""$bgreen"" ? ""$normal""  $1 \n      > "
	read -p "" rep
}

function clearscreen {
	lignes=$((`tput lines`-3))
	cols=$(tput cols)
	tput cup 2 0
	for i in $(seq 1 $lignes)
	do
		printf "$bblack""%$(tput cols)s" ""
	done
	tput cup 3 0
}

function resultscreen {
	clearscreen
	cols=$(tput cols)
	title="    $1    "
	line1=" $2 "
	line2=" $3 "
	line3=" $4 "
	line4=" $5 "
	line5=" $6 "
	tput cup 3 2
	printf "$bblue""$bwhite""%$(($cols-4))s"
	for i in 4 5 6 7 8 9 10; do
		tput cup $i 2
		printf "$bblue""$bwhite""%$(($cols-4))s"
	done
	tput cup 3 $((($cols-${#title})/2))
	echo -e $bblue"$cyan""$title"$normal; #titre
	tput cup 5 $((($cols-${#line1})/2)); #line1
	echo -e $bblue"$line1"$normal
	tput cup 6 $((($cols-${#line2})/2)); #line2
	echo -e $bblue"$line2"$normal
	tput cup 7 $((($cols-${#line3})/2)); #line3
	echo -e $bblue"$line3"$normal
	tput cup 8 $((($cols-${#line4})/2)); #line4
	echo -e $bblue"$line4"$normal
	tput cup 9 $((($cols-${#line5})/2)); #line5
	echo -e $bblue"$line5"$normal
	tput cup 12 1
    echo -ne "\n  $bgreen"
    read -p "$BACKMSG Press any key to return to the main menu " -n1
    echo -e "$normal"
	$BACKMSG = ''
    menu_root
}

function returnmainmenu {
     echo -ne "\n  $bred"
     read -p "$BACKMSG Press any key to return to the main menu " -n1
     echo -e "$normal"
	 $BACKMSG=''
	 menu_root
}

function returnshellmenu {
     echo -ne "\n  $bblue"
     read -p "$BACKMSG Press any key to return to the shell menu " -n1
     echo -e "$normal"
	 $BACKMSG=''
	 menu_shell
}

function exitscript {
	clear
	echo
	echo $QUITMSG
	echo
	exit 0
}

# Script functions

function checkSudo {
	if [ "$EUID" -ne 0 ]
  	then 
		echo
	    echo "You need to run the script as root. Try with: 'sudo bash $0'"
		echo
    		exit 0
	fi
}

function checkIP {
  echo
  if [[ $1 == "IP" ]]
  then
    IP=$2
  fi
  if [ -z "$IP" ]
  then
  	echo -ne " ""$bgreen"" ? ""$normal""  Please enter the external IP of your system (0=quit) \n      > "
	read -p "" IP 
  fi
  if [[ $IP == "0"  ]]
  then
  	QUITMSG="Quitting..."
  	exitscript
  fi 
  if [[ ! $IP =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]
  then
    echo
    echo "IP is not valid."
	IP=
    checkIP
  fi
}

function installNode {
	printTitle "Install node"
	sudo docker -v > /dev/null 2>&1
  	if [ $? -ne 0 ]
  	then
    		BACKMSG="Docker is not installed. Installation cannot continue."
    		returnmainmenu
  	fi
	echo
  	echo "  By accepting to proceed, you acknowledge and accept Bitagora's terms of service and privacy policy."
	echo "  If you haven't done so, please read this information before installing a node: "
	echo "    https://bitagora.cc/static/en/terms"
	echo "    https://bitagora.cc/static/en/privacy"
	echo
  	input "Are you sure you want to install a Bitagora validator node? (yes/no) "
  	if [ $rep == 'yes' ]
  	then
		echo 
		input "Your external IP appears to be ${IP}. Do you want to install the node on this IP? (yes/no)"
		if [ $rep == 'no' ]
		then
		    IP=
			checkIP
		fi
		echo
		echo "  Checking that there are no Bitagora containers already installed..."
		sudo docker-compose down  >/dev/null 2>&1
		echo
		containers="$(sudo docker ps -a -q --filter='name=bitagora*')"
 		if [[ -z $containers ]]
		then
			echo
			echo "  No Bitagora installation detected in the system."
			echo
		else
			echo
			input "  There are Bitagora containers in the system. Do you want to remove them? (yes/no) "
			if [ $rep == 'no' ]
			then
		    		BACKMSG="Installation cannot continue."
    				returnmainmenu
			else
				echo
				echo "  Removing Bitagora containers..."
	  			sudo docker stop $containers && sudo docker rm $containers
				echo
				if [ "$?" -ne "0" ] 
				then
					BACKMSG="Failed to remove containers. Please remove them manually. Installation cannot continue."
    					returnmainmenu
				fi
			fi
		fi
  		echo "  Downloading configuration files..."
		echo
  		if [ -f docker-compose.yaml ]
  		then
    			sudo rm docker-compose.yaml
  		fi
  		if [ -f validator.toml ]
  		then
    			sudo rm validator.toml
  		fi
		## Temporary
		wget -q https://bitbucket.org/bitagora/bitagora-public/downloads/docker-compose.yaml > /dev/null
 		## wget -q https://raw.githubusercontent.com/bitagora/bitagora-node/master/docker-compose.yaml > /dev/null
		if [ "$?" -ne 0 ]
		then
			BACKMSG="Failed to download docker-compose.yaml from Bitagora repo. Installation cannot continue."
			returnmainmenu
		fi
		## Temporary
		wget -q https://bitbucket.org/bitagora/bitagora-public/downloads/validator.toml > /dev/null
		## wget -q  https://raw.githubusercontent.com/bitagora/bitagora-node/master/validator.toml > /dev/null
		if [ "$?" -ne 0 ]
		then
			BACKMSG="Failed to download validator.toml from Bitagora repo. Installation cannot continue."
			returnmainmenu
		fi
  		sed -i "s/NIP/$IP/g" validator.toml
  		sed -i "s/NIP/$IP/g" docker-compose.yaml

		echo
		echo "  Looking for list of seed nodes..."
  		seeds=""
  		nodes=($(echo $(curl -o- -s https://bitagora.cc/nodes/list.json)))
  		i=1
		let length=${#nodes[@]}-1
		count=0
  		while [  $i -lt $length ]; do
    			if [[ ${nodes[$i]} ]] && [[ ${nodes[$i]} != *"]"* ]] && [[ ${nodes[$i]} != *"["* ]]
    			then
     		 	nodes[$i]="${nodes[$i]//\"/}"
      			nodes[$i]="${nodes[$i]//\,/}"
      			nodes[$i]="\"tcp://${nodes[$i]}:8801\""
				let comp=length-1
				if [ $i -lt $comp ]
				then
					nodes[$i]="${nodes[$i]},"
				fi
				let count=count+1
    			fi
    			seeds="${seeds}${nodes[$i]}"
    			let i=i+1
  		done
		seeds="[${seeds}]"
		if [ $count -gt 0 ]
		then
  			sed -i "s#SEEDS#$seeds#g" validator.toml
			echo "  Found $count seed nodes: $seeds"	
			echo
			echo "  Checking ports..."
			echo
	 		open8801="$(nc -z -v -w 3 $IP 8801 &> /dev/null; echo $?)"
  			open8008="$(nc -z -v -w 3 $IP 8008 &> /dev/null; echo $?)"
  			if [[ open8801 -eq 0 ]] || [[ open8008 -eq 0 ]]
  			then
    				BACKMSG="Ports 8801 and/or 8008 are not available. Installation cannot continue."
    				returnmainmenu
  			else
				sudo ufw status | grep -qw active 
    				if [[ $? -eq 0 ]]
    				then
					echo
					echo "  Found ufw firewall active"
					echo
    					input "Allow external connections on ports 8801 and 8008 through ufw firewall? (yes/no)" 
    					if [[ $rep == "yes" ]]
    					then
						echo
    						sudo ufw allow 8801/tcp > /dev/null 2>&1
    						sudo ufw allow 8008/tcp > /dev/null 2>&1
    					else
    						BACKMSG="Ports need to be open to install a node. Installation cannot continue."
    						returnmainmenu
    					fi
 				else
					echo
      				echo "  No firewall detected."
					echo
					input "Are you sure that ports 8801 and 8008 are allowed? (yes/no)"
      				if [[ $rep != "yes" ]]
     				then
       					BACKMSG="Ports need to be open to install a node. Installation cannot continue."
        					returnmainmenu
      				fi
    				fi
				echo
				echo "  Building new node..."
				echo
				input "Do you want to run the node in the background [recommended]? (yes/no)"
				if [[ $rep == "no" ]]
  				then
					echo
					echo "  Once started, the node will begin to produce output messages, as it connects with other peers."
					echo "  When you close the terminal or press 'Ctrl+C', the node will stop and be disconnect from the network."
					echo
					input "Do you want to continue with the installation? (yes/no)"
					echo
					if [[ $rep == "yes" ]]
					then
    						sudo docker-compose up
					else
						menu_root
					fi
  				else
					echo
					echo "  Downloading images and starting node. This might take a few minutes..."
					echo
    					sudo docker-compose up -d
					if [ $? -eq 0 ]; then
						resultscreen "Installation successfully completed" "Your node is now up and running. Enter the shell from the script menu or by typing in your terminal: " "docker exec -it bitagora-shell bash" " " "Please consider adding your node to the seed list of validator nodes available at the Bitagora website." "Send an email to mail@bitagora.cc with the Subject 'Add node' and your IP as the body of the message." 
    					else
      					sudo docker-compose down
      					BACKMSG="Installation failed. Node has not been set up."
      					returnmainmenu
    					fi
				fi
			fi
		else
			BACKMSG="No seed nodes found. Installation cannot continue."
			returnmainmenu
		fi 
	else
		BACKMSG="Installation cannot continue."
		returnmainmenu
	fi
}

function uninstallNode {
	printTitle "Uninstall node"
	echo
	echo "  This operation will completely remove the validator node containers and images from your system. This cannot be undone."
	echo "  After uninstalling, if you wish, you will be able to reinstall a new node from scratch."
	echo
	input "Are you sure you want to remove the validator node? (yes/no)"
	echo
	if [[ $rep == "yes" ]]
	then
		error=0
		declare -a ERRORS
 		containers="$(sudo docker ps -a -q --filter='name=bitagora*')"
 		if [[ -z $containers ]]
		then
			echo "  No node containers found in the system."
		else
			echo
			echo "  Stopping containers..."
			echo
  			sudo docker-compose down
			if [ "$?" -ne "0" ] 
			then
				echo "  Containers already stopped."
			fi
			echo
			echo "  Removing containers..."
			echo
  			containers="$(sudo docker ps -a -q --filter='name=bitagora*')"
  			sudo docker stop $containers && sudo docker rm $containers
			if [ "$?" -ne "0" ] 
			then
				ERRORS[0]="  Node containers could not be removed. Please remove them manually:"
				ERRORS[1]="  -->$ sudo docker stop $(sudo docker ps -a -q --filter='name=bitagora*')"
				ERRORS[2]="  -->$ sudo docker rm $(sudo docker ps -a -q --filter='name=bitagora*')"
				let error=2
			fi
		fi
		echo
		echo "  Removing images..."
		echo
 		images="$(sudo docker images --filter=reference='bitagora/*' --format '{{.ID}}')"
  		sudo docker rmi $images
		if [ "$?" -ne "0" ] 
		then
			let error=error+1
			ERRORS[$error]="  Node images could not be removed. Please remove them manually:"
			let error=error+1
			ERRORS[$error]="  -->$ sudo docker rmi $(sudo docker images --filter=reference='bitagora/*' --format '{{.ID}}')"
		fi
		echo
		echo "  Removing configuration files..."
		echo
  		rm docker-compose.yaml && rm validator.toml
		if [ "$?" -ne "0" ] 
		then
			let error=error+1
			ERRORS[$error]="  Configuration files could not be removed. Please remove them manually:"
		 	let error=error+1
			ERRORS[$error]="  -->$ rm docker-compose.yaml && rm validator.toml"
		fi
		if [[ $error -eq 0 ]]
		then
			resultscreen "Node succesfully removed" "Bitagora Node has been completely removed from your system." "All docker images and containers have been deleted." "Only this script remains in your computer." "You can remove it by typing: 'rm bitagora-node-ubuntu.sh'" 
		else
			echo 
			echo "  Errors were encountered during the process of uninstalling the node."
			echo "  These errors might be due to the fact that you don't have a node installed."
			echo "  If you have one, you will need to use the manual instructions provided to uninstall it."
			echo "  -----------------------"
			for i in "${ERRORS[@]}"
			do
				echo $i
        		done
			echo "  ----------------------"
			echo
			input "Do you want to stop the script and run these instructions now? (yes/no)"
			echo
			if [[ $rep == "yes" ]]
			then
				echo
				exit 0
			else
				menu_root
			fi
		fi
	else
		BACKMSG="Nothing was done."
		returnmainmenu
	fi
}

function statusNode {
	printTitle "Node status"
	echo
	sudo docker ps --filter="name=bitagora*" --format "table {{.Names}}\t{{.ID}}\t{{.RunningFor}}\t{{.Ports}}\t{{.Status}}"
	BACKMSG=""
	returnmainmenu
}

function stopNode {
	printTitle "Stop node"
	echo
	input "Are you sure you want to stop the validator node? (yes/no)"
	if [[ $rep == "yes" ]]
	then
		echo "  Stopping node..."
  		sudo docker-compose down
		if [ "$?" -ne "0" ] 
		then
			BACKMSG="Node cannot be stopped. Please check its status. Maybe it's not running."
			returnmainmenu
		fi
  		containers="$(sudo docker ps -a -q --filter='name=bitagora*')"
  		if [[ -z "$containers" ]]
  		then
    			echo "  Node has already stopped"
  		else
			echo "  Stopping node containers..."
    			sudo docker stop $containers
			if [ "$?" -ne "0" ] 
			then
				BACKMSG="An error was encountered while stopping the containers. Please check node status."
				returnmainmenu
			fi
  		fi
		resultscreen "Node succesfully stopped" "The containers running your node have been stopped but not removed." "To restart them, use the main menu of this script." 
	else
		BACKMSG="Nothing was done."
		returnmainmenu
	fi
}

function restartNode {
	printTitle "Restart node"
	echo
	input "Are you sure you want to stop the validator node? (yes/no)"
	if [[ $rep == "yes" ]]
	then
		input "Do you want to run the node in the background [recommended]? (yes/no)"
		if [[ $rep == "no" ]]
		then
			echo
			echo "  Once started, the node will begin to produce output messages, as it connects with other peers."
			echo "  When you close the terminal or press 'Ctrl+C', the node will stop and be disconnected from the network."
			echo
			input "Do you want to restart the node now? (yes/no)"
			if [[ $rep == "yes" ]]
			then
				sudo docker-compose up
				if [ "$?" -ne "0" ] 
				then
					sudo docker-compose down
					BACKMSG="Node cannot be started."
					returnmainmenu
				fi
			else
				menu_root
			fi
		else
    			sudo docker-compose up -d
			if [ $? -eq 0 ]; then	
				resultscreen "Node succesfully restarted" "Your node has been restarted and is now back up and running." "Enter shell by typing:" "docker exec -it bitagora-shell bash" 
    			else
      			sudo docker-compose down
      			BACKMSG="Could not restart node. If error persists, please uninstall and reinstall the node."
	  			returnmainmenu
    			fi
  		fi
	else
		BACKMSG="Nothing was done."
		returnmainmenu
	fi
}

# Shell functions

function list {
	clearscreen
	printTitle "Listing $1 $2"
	echo
	sudo docker exec -it bitagora-shell node shell.js list $1 $2
	returnshellmenu
}

function show {
	clearscreen
	printTitle "Showing $1"
	echo
	sudo docker exec -it bitagora-shell node shell.js show $1 $2 $3
	returnshellmenu	
}

function get_keys {
	clearscreen
	printTitle "Node keys"
	echo
 	echo "Private key: "
	sudo docker exec -it bitagora-shell cat /etc/sawtooth/keys/validator.priv
	echo
	echo "Public key: " 
	sudo docker exec -it bitagora-shell cat /etc/sawtooth/keys/validator.pub
	echo
	returnshellmenu		
}

function viewConsole {
	clearscreen
	printTitle "Node console $1"
	printOption "result" "" "Press Ctrl + C to go back to menu"
	echo 
	echo
	trap menu_console SIGINT
	sudo docker logs -f $1
}

# Menus

function menu_root {
	while true; do
		clear
		printTitle "Bitagora Node script"
        printOption "result" "DATE" "`date +'%a %d %B %Y'`"
        printOption "result" "IP" "$IP"
		echo
		printOption "desc" "1" "INSTALL" "Install a node in your system"
		printOption "desc" "2" "UNINSTALL" "Uninstall node from your system"
		printOption "desc" "3" "STATUS" "View status of your node"
		printOption "desc" "4" "STOP" "Stop your node"
		printOption "desc" "5" "RESTART" "Restart your node"
		printOption "desc" "6" "SHELL" "Enter node shell"
		printOption "desc" "7" "CONSOLE" "View node console output"
		printOption "desc" "Q" "QUIT" "Quit script"
		echo
		read -p " What do you want to do? " -n1 rep
		case $rep in
			[1]* )
				clearscreen
           		installNode               
				break;;
			[2]* )
				clearscreen
				uninstallNode
				break;;
			[3]* )
				clearscreen
				statusNode
				break;;
			[4]* )
				clearscreen
				stopNode
				break;;
			[5]* )
				clearscreen
				restartNode
				break;;
			[6]* )
				clearscreen
				menu_shell
				break;;
			[7]* )
				clearscreen
				menu_console
				break;;
			[qQ]* )
				exitscript;
				break;;
			* ) returnhome;;
		esac
	done
	returnmainmenu
}

function menu_shell {
	while true; do
		clear
		printTitle "Node Shell"
        printOption "result" "DATE" "`date +'%a %d %B %Y'`"
        printOption "result" "IP" "$IP"
		echo

		printOption "desc" "1" "POLLS" "List or show polls"
		printOption "desc" "2" "BALLOTS" "List or show ballots"
		printOption "desc" "3" "BLOCKS" "List or show blocks"
		printOption "desc" "4" "STATE" "List or show state addresses"
		printOption "desc" "5" "PEERS" "List or compare with peers"
		printOption "desc" "6" "SETTINGS" "List settings"
		printOption "desc" "7" "KEYS" "Show node keys"
		printOption "desc" "Q" "MENU" "Back to main menu"
		echo
		read -p " Choose an option : " -n1 rep
		echo 
		case $rep in
			[1]* ) 
				echo
				echo "  (L)ist all available polls "
				echo "  (S)how a poll with id"
				echo 
				read -p "  What do you want to do? " -n1 rep
				case $rep in
					[lL]* ) 
						list "polls" 
						break;;
					[sS]*) 
						echo 
						echo
						input "Enter the poll 8-digit alphanumerical id"
						show "poll" $rep
						break;;
					* ) 
						menu_shell
						break;;
				esac
				break;;	
			[2]* )
				echo 
				echo
				echo "  (L)ist all ballots for a poll"
				echo "  (S)how information of a ballot with id or private key"
				echo 
				read -p "  What do you want to do? " -n1 rep
				case $rep in
					[lL]* ) 
						echo 
						echo
						input "Enter the poll 8-digit alphanumerical id (0 to cancel)"
						poll=$rep
						if [[ $poll == "0" ]] 
						then
							menu_shell
						else	
							list "ballots" $poll
						fi
						break;;
					[sS]*) 
						echo
						echo
						input "Enter the poll 8-digit alphanumerical id (0 to cancel)"
						poll=$rep
						if [[ $poll == "0" ]] 
						then
							menu_shell
						fi
						echo
						input "Enter the vote id number or a voter private key (0 to cancel)"
						id=$rep
						if [[ $id == "0" ]] 
						then
							menu_shell
						fi
						show "ballot" $poll $id
						break;;
					* ) 
						menu_shell
						break;;
				esac
				break;;	
			[3]* ) 
				echo
				echo "  (L)ist all blocks in the chain "
				echo "  (S)how a block with id"
				echo 
				read -p "  What do you want to do? " -n1 rep
				case $rep in
					[lL]* ) 
						list "blocks" 
						break;;
					[sS]*) 
						echo
						echo 
						input "Enter the block alphanumerical id"
						show "block" $rep
						break;;
					* ) 
						menu_shell
						break;;
				esac	
				break;;
			[4]* ) 
				echo
				echo "  (L)ist current state of blockchain "
				echo "  (S)how state of an address with id"
				echo 
				read -p "  What do you want to do? " -n1 rep
				case $rep in
					[lL]* ) 
						list "state" 
						break;;
					[sS]*) 
						echo
						echo
						input "Enter the address alphanumerical id"
						show "state" $rep
						break;;
				* ) 
					menu_shell
					break;;
				esac	
				break;;
			[5]* ) 
				list "peers" 
				break;;
			[6]* ) 
				list "settings" 
				break;;
			[7]* ) 
				get_keys 
				break;;
			[qQ]* ) 
				menu_root 
				break;;			
			* ) menu_shell; break;;
		esac
	done
}

function menu_console {
	while true; do
		clear
		printTitle "Node Console"
        printOption "result" "DATE" "`date +'%a %d %B %Y'`"
        printOption "result" "IP" "$IP"
		echo

		printOption "desc" "1" "VALIDATOR" "View validator console"
		printOption "desc" "2" "POLLS" "View polls transaction processor console"
		printOption "desc" "3" "BALLOTS" "View ballots transaction processor console"
		printOption "desc" "4" "SETTINGS" "View settings transaction processor console"
		printOption "desc" "Q" "MENU" "Back to main menu"
		echo
		read -p " Choose an option : " -n1 rep
		echo 
		case $rep in
			[1]* ) 
				viewConsole "bitagora-validator"
				break;;
			[2]* ) 
				viewConsole "bitagora-polls-tp"
				break;;	
			[3]* ) 
				viewConsole "bitagora-ballots-tp"
				break;;	
			[4]* ) 
				viewConsole "bitagora-settings-tp"
				break;;	
			[qQ]* ) 
				menu_root 
				break;;			
			* ) menu_console; break;;
		esac
	done
}

### Runtime
checkSudo
IP=$(ifconfig eth0 | perl -ne 'print $1 if /inet\s.*?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/')
clearscreen
checkIP
menu_root
