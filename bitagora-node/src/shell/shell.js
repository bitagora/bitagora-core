/**
 * BITAGORA NODE
 * shell.js
 * Shell functions for Bitagora Platform voting system
 * Developed by Ignasi Ribó, 2018
 * Repo: https://github.com/bitagora/bitagora-core
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ------------------------------------------------------------------------------
 */

 'use strict'
 const { BITAGORA_URL, BITAGORA_PREFIX, requestState } = require('bitagora-library');
 const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
 const Bs58 = require('base-x')(BASE58);
 const { Secp256k1PrivateKey } = require('sawtooth-sdk/signing/secp256k1');
 const { createContext } = require('sawtooth-sdk/signing');
 const cTable = require('console.table');
 const shell = require('shelljs');
 const today = new Date();

 function Vote(option, ballots)  {
 	this.option = option;
 	this.ballots = ballots;	
 }

 function fetchVote(data) {
 	return new Promise((resolve) => {
 		try {	   
 			if (!Boolean(data.id)) {
 				if (Boolean(data.privkey)) {
 					const privkey_hex = Bs58.decode(data.privkey).toString('hex');
 					const privateKey = Secp256k1PrivateKey.fromHex(privkey_hex);
 					const signerContext = createContext('secp256k1');
 					data['id'] = signerContext.getPublicKey(privateKey).asHex();
 				}
 			}
 			if (!Boolean(data.poll) || !Boolean(data.id)) throw 'No data';
 			requestState(BITAGORA_URL, 'poll', data.poll, null, null, null, false).then((pollResult) => {
 				try {
 					if (pollResult.status != 'FOUND') throw 'Poll not found';
 					let poll = JSON.parse(pollResult.data.poll);
 					var pollkey;
 					if (!poll.open && Boolean(poll.privkey)) pollkey = poll.privkey; 
 					requestState(BITAGORA_URL, 'ballot', data.poll, data.id, null, pollkey).then((result) => {
 						resolve(result);		
 					}).catch((e) => {
 						resolve({status: 'UNKNOWN' });
 					});
 				} catch(e) {
 					resolve({status: 'UNKNOWN' });
 				}
 			}).catch((e) => {
 				resolve({status: 'UNKNOWN' });
 			});
 		} catch(e) {
 			resolve({status: 'UNKNOWN' });
 		}
 	});
 }

 function check(data) {
 	return new Promise((resolve) => {
 		/* Takes as data an object with params (poll id) 'poll' and either (vote) 'id' or (voter) 'privkey' */
 		if (!Boolean(data)) resolve(false);
 		if (!Boolean(data.poll)) resolve(false);
 		if (!Boolean(data.id) && !Boolean(data.privkey)) resolve(false);
 		fetchVote(data).then((result) => {
 			resolve(result);
 		});
 	});
 };

 function recount(pollId) {
 	return new Promise((resolve) => {
 		/* Takes a single param 'pollId' */
 		if (!Boolean(pollId)) return false;
 		try {
 			requestState(BITAGORA_URL, 'poll', pollId, null, null).then((result) => {
 				resolve(result);		
 			});
 		} catch(e) {
 			console.log(e);
 			resolve({status: 'ERROR' });
 		}
 	});
 };

 function listPolls() {
 	return new Promise((resolve) => {
 		try {
 			requestState(BITAGORA_URL, 'polls').then((result) => {
 				resolve(result);
 			}).catch((e) => {
 				resolve({ status: 'ERROR' });
 			});
 		} catch(e) {
 			resolve({ status: 'ERROR' });
 		}
 	});
 }

 function getNodeLocation(href) {
 	var match = href.match(/^(tcp?\:)\/\/(([^:\/?#]*)(?:\:([0-9]+))?)([\/]{0,1}[^?#]*)(\?[^#]*|)(#.*|)$/);
 	return match && {
 		href: href,
 		protocol: match[1],
 		host: match[2],
 		hostname: match[3],
 		port: match[4],
 		pathname: match[5],
 		search: match[6],
 		hash: match[7]
 	}
 }

 function listBallots(pollId) {
 	return new Promise((resolve) => {
 		try {
 			requestState(BITAGORA_URL, 'poll', pollId).then((result) => {
 				try {
 					if (!Boolean(result)) throw 'No data';
 					if (result.status != 'FOUND') throw 'Poll not found';
 					let poll = JSON.parse(result.data.poll);
 					var pollkey;
 					if (!poll.open && Boolean(poll.privkey)) {
 						resolve(result);
 					} else {
 						if (!poll.open) {
 							resolve({ status: 'UNKNOWN', votes: result.data.votes });
 						} else {
 							if (result.data.votes > 5000) {
 								console.log("This poll contains "+ result.data.votes.toLocaleString() + " ballots.");
 								console.log("Please be aware that the process of parsing so many ballots will take some time.");
 								console.log("Opening ballot boxes...");	
 								console.log("\r");
 							} 
 							requestState(BITAGORA_URL, 'ballots', pollId, null, null, poll.privkey).then((response) => {
 								resolve(response);
 							}).catch((e) => {
 								resolve({ status: 'ERROR' });
 							});							
 						}
 					}
 				} catch(e) {
 					resolve({ status: 'ERROR' });
 				}
 			}).catch((e) => {
 				resolve({ status: 'ERROR' });
 			});
 		} catch(e) {
 			resolve({ status: 'ERROR' });
 		}
 	});
 }

 try {
 	shell.config.silent = true;
 	let api = process.env.API_URL;
 	var args = process.argv.slice(2);
 	if (args[0] === undefined || args[1] === undefined) throw '  Empty command';
 	if (args[0] == 'list') {
 		if (args[1] == 'polls') {  
 			listPolls().then((result) => {
 				console.group();
 				if (Boolean(result) && result.status == 'FOUND') {
 					let polls = result.polls;
 					if (polls.length == 0) {
 						console.log("No polls found");
 					} else if (polls.length == 1) {
 						console.log("Found 1 poll:");
 					} else {
 						console.log("Found "+polls.length.toLocaleString()+" polls:");
 						polls.sort((a, b) => parseInt(a.votes) - parseInt(b.votes)).reverse();
 					}
 					console.log('\r');
 					if (polls.length > 20) {
 						console.log("Listing only active and pending polls:");
 						console.log('\r');
 						let list = [];
 						let unlisted = [];
 						polls.forEach(function(obj) {
 							if (obj['votes'] > 0 || new Date(obj['ends']) > today ) {
 								obj['votes'] = obj['votes'].toLocaleString();
 								list.push(obj);
 							} else {
 								unlisted.push(obj['id']);
 							}
 						});
 						console.table(list);
 						if (unlisted.length > 0)	console.log("Unlisted poll IDs: "+unlisted.join(", "));
 					} else {
 						polls.forEach(function(obj){ obj['votes'] = obj['votes'].toLocaleString(); }); 
 						console.table(polls);	
 					}
 					console.log('\r');
 				} else {
 					console.log("No polls found");
 				}
 				console.groupEnd();
 			}).catch((e) => {
 				console.log("No polls found");
 			});
 		} else if (args[1] == 'ballots') {
 			if (!Boolean(args[2])) throw '  Argument [pollId] missing';
 			let pollId = args[2];
 			listBallots(pollId).then((result) => {
 				console.group();
 				if (Boolean(result.status) && result.status == "FOUND") {
 					console.log(result.data.boxes['00'])
 					if (result.data.votes == 0) {
 						console.log("\r");
 						console.log("No ballots found for poll "+pollId+"\n"); 
 						console.log("\n");
 					} else if (result.data.votes < 100) {
 						console.log("\r");
 						console.log("Found "+result.data.votes.toLocaleString() +" ballots for poll "+pollId+":");
 						console.log("\r");
 						console.log(result.data.boxes);
 						console.log("\n");
 					} else {
 						console.log("\r");						
 						console.log("Found "+ result.data.votes.toLocaleString()+" ballots for poll "+pollId+".");
 						var fs = require('fs');
 						fs.writeFile("ballots-"+pollId+".json", JSON.stringify(result), function(err) { 
 							if (err) {
 								return console.log(err);
 							} else {
 								console.log("The full list of ballots has been saved to file. You can view it by typing: cat ballots-"+ pollId+".json from the shell container. \n");
 							}
 						}); 
 						console.log("\n");
 					}
 				} else if (Boolean(result.status) && result.status == "UNKNOWN") {
 					if ( Boolean(result.data.votes) && result.data.votes > 0 ) {
 						console.log("\r");
 						console.log("Found "+ result.votes.toLocaleString() +" ballots for poll "+ pollId + ".");
 						console.log("This poll is encrypted and ballots cannot be parsed until the poll secret key has been published.");
 						console.log("\n");
 					} else if ( Boolean(result.data.votes) && result.data.votes == 0 ) {
 						console.log("\r");
 						console.log("No ballots cast yet.");
 						console.log("\n");
 					} else {
 						console.log("Nothing found\n");					
 					}
 				} else {
 					console.log("Nothing found\n");
 				}
 				console.groupEnd();
 			}).catch((e) => {
 				console.log(e);
 				console.log("\r");
 			});
 		} else if (args[1] == 'blocks') {
 			shell.exec("sawtooth block list --url "+api, function(code, stdout, stderr) {
 				console.group();
 				if (code == 0) {
 					console.table(stdout);
 					console.log('\r');
 				} else {
 					console.log('Command could not be executed\n');
 				}
 				console.groupEnd();
 			});
 		} else if (args[1] == 'peers') {
 			shell.exec("sawtooth peer list --url "+api, function(code, stdout, stderr) {
 				console.group();
 				if (code == 0) {
 					let peers = stdout.split(",");
 					if (peers.length == 0) {
 						console.log("Your node seems to have no peers. Try uninstalling and reinstalling the node again.");	
 						console.log('\r');
 					} else {
 						console.log("Your node [0] is peered with the following validators: ");
 						console.log("\r");
 						for (var i=0; i<peers.length; i++) {
 							console.log("["+ (i+1).toString() + "] " + getNodeLocation(peers[i]).hostname);
 							peers[i] = "http://" + getNodeLocation(peers[i]).hostname + ":8008";
 						}
 						peers.unshift(api);
 						let unique = peers.filter(function(value, index, self) { return self.indexOf(value) === index; });
 						let compare = unique.join(" ");
 						console.log("\r");
 						console.log("Network information:");
 						shell.exec("sawnet compare-chains "+compare, function(code, stdout, stderr) {
 							console.group();
 							if (code == 0) {
 								console.table(stdout);
 								console.log("\n");
 							}
 							console.groupEnd();
 						});	
 						console.log("\r");
 					}
 				} else {
 					console.log("Command could not be executed\n");
 				}
 				console.groupEnd();
 			});
 		} else if (args[1] == 'settings') { 
 			shell.exec("sawtooth settings list --url "+api, function(code, stdout, stderr) {
 				console.group();
 				if (code == 0) {
 					console.log('\r');
 					console.table(stdout);
 					console.log('\r');
 				} else {
 					console.log("Command could not be executed\n");
 				}
 				console.groupEnd();
 			});
 		} else if (args[1] == 'state') { 
 			shell.exec("sawtooth state list --url "+api, function(code, stdout, stderr) {
 				console.group();
 				if (code == 0) {
 					console.table(stdout);
 				} else {
 					console.log("Command could not be executed\n");
 				}
 				console.groupEnd();
 			});
 		} else {
 			throw("  Wrong command. Can only list 'polls', 'blocks', 'settings', 'state' or 'peers'");
 		}
 	} else if (args[0] == 'show') {
 		if (args[1] == 'ballot') {
 			if (!Boolean(args[2])) throw '  Argument [pollId] missing';
 			let pollId = args[2];
 			if (!Boolean(args[3])) throw '  Argument [voteId/privateKey/address] missing';
 			var data;
 			if (args[3].substr(0,2) == "02" || args[3].substr(0,2) == "03") {
 				data = { poll: pollId, id: args[3] };
 			} else if (args[3].substr(0,6) == BITAGORA_PREFIX) {
 				data = { poll: pollId, id: args[3] };
 			} else {
 				data = { poll: pollId, privkey: args[3] };
 			}
 			check(data).then((result) => {
 				console.group();
 				if (Boolean(result.status) && result.status == "FOUND") {
 					let ballotTable = {
 						'poll': data.poll,
 						'voter': data.id,
 						'ballot': result.data
 					}
 					console.log("\r");
 					console.log("Ballot found:");
 					console.log("\r");
 					console.table(ballotTable);
 					console.log("\r");
 				} else {
 					console.log("Ballot not found\n");
 				}
 				console.groupEnd();
 			});
 		} else if (args[1] == 'poll') {
 			if (!Boolean(args[2])) throw '  Argument [pollId] missing';
 			let pollId = args[2];
 			recount(pollId).then((result) => {
 				console.group();
 				if (Boolean(result) && Boolean(result.data.poll) && (result.status == "FOUND" || result.status == "UNKNOWN")) {
 					console.log('\r');
 					let poll = JSON.parse(result.data.poll);
 					poll.values = JSON.stringify(poll.values);
 					poll.starts = new Date(parseInt(poll.starts)).toDateString();
 					poll.ends = new Date(parseInt(poll.ends)).toDateString();
 					console.table(poll);
 					console.group();
 					console.log("--------------------------------------------------------------------------------------------------------------------------------");
 					console.log("RESULTS:");
 					console.log("Total ballots cast: "+result.data.votes.toLocaleString());
 					let showResults = true;
 					if (!poll.open && !Boolean(poll.privkey)) showResults = false;
 					if (showResults && Boolean(result.data.ballots) && Object.keys(result.data.ballots).length > 0) {
 						let val = JSON.parse(poll.values);
 						let bal = result.data.ballots;
 						Object.keys(bal).forEach(function(k){ bal[k] = bal[k].toLocaleString(); }); 
 						console.table(bal);
 					} else {
 						console.log("No results available");
 					}
 					console.log("--------------------------------------------------------------------------------------------------------------------------------");
 					console.log("\r");
 					console.groupEnd();
 				} else {
 					console.log("Nothing found\n");
 				}
 				console.groupEnd();
 			});
 		} else if (args[1] == 'block') { 
 			if (!Boolean(args[2])) throw '  Argument [blockId] missing';
 			shell.exec("sawtooth block show "+args[2]+" --url "+api, function(code, stdout, stderr) {
 				console.group();
 				if (code == 0) {
 					console.table(stdout);
 					console.log("\n");
 				} else {
 					console.log("Command could not be executed\n");
 				}
 				console.groupEnd();
 			});
 		} else if (args[1] == 'state') { 
 			if (!Boolean(args[2])) throw '  Argument [address] missing';
 			shell.exec("sawtooth state show "+args[2]+" --url "+api, function(code, stdout, stderr) {
 				console.group();
 				if (code== 0) {
 					console.table(stdout);
 					console.log('\r');
 				} else {
 					console.log("Command could not be executed\n");
 				}
 				console.groupEnd();
 			});
 		} else {
 			throw '  Wrong command';
 		}
 	}
 } catch(e) {
 	console.group();  
 	console.log('\r');
 	console.log('  Bitagora Shell - Usage:');
 	console.log('  bitagora list [ polls | blocks | state | peers | settings ]');
 	console.log('  bitagora list ballots < poll_id >');
 	console.log('  bitagora show [ poll | ballot | block | state ] < argument > < argument >');
 	console.log('    bitagora show ballot < poll_id > < voter_private_key | vote_id >');
 	console.log('    bitagora show poll < poll_id >');
 	console.log('    bitagora show block < block_id >');
 	console.log('    bitagora show state < address >');
 	console.log('\r');
 	console.groupEnd();
 }
