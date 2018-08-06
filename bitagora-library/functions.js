/**
 * BITAGORA LIBRARY
 * functions.js
 * Shared functions for Bitagora Platform JS modules
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
 const { BITAGORA_PREFIX } = require('./constants.js');
 const crypto = require('crypto');
 const atob = require('atob');
 const btoa = require('btoa');
 const cbor = require('cbor');
 const EC = require("elliptic").ec;
 const ec = new EC("secp256k1");
 const Buffer = require('safe-buffer').Buffer

 const _hash = (sha, x) => crypto.createHash(sha).update(x).digest('hex').toLowerCase();

 function getPrechecksumVote(vote) {
 	return vote.prefix + vote.id + vote.date + vote.poll;
 }

 function getPollToken(poll) {
 	try {
 		return JSON.stringify({
 			id: poll.id,
 			certkey: poll.certkey,
 			starts: poll.starts,
 			ends: poll.ends,
 			question: poll.question,
 			values: poll.values,
 			open: poll.open,
 			adminkey: poll.adminkey
 		});
 	} catch(e) {
 		return null;
 	}
 }

 function getVoteToken(vote) {
 	try {
 		return JSON.stringify({
 			prefix: vote.prefix,
 			id: vote.id,
 			date: vote.date,
 			poll: vote.poll,
 			checksum: vote.checksum
 		});
 	} catch(e) {
 		return null;
 	}
 }

 function getPollAddress(pollId) { 
 	return BITAGORA_PREFIX + 'bbbb' + pollId + 'bbbb' + _hash('sha512', pollId).substr(0,48); 
 }

 function getVoteAddress(pollId, voteId) { 
 	return BITAGORA_PREFIX + pollId + voteId.substr(0,56); 
 }

 function getSettingAddress(string) {
 	let values = string.split(".");
 	if (!Boolean(values)) return undefined;
 	if (!Boolean(values[3])) values[3] = "";
 	return  '000000' + _hash('sha256', values[0]).substr(0,16) + _hash('sha256', values[1]).substr(0,16) + _hash('sha256', values[2]).substr(0,16) + _hash('sha256', values[3]).substr(0,16);
 }

 function requestURL(url) {
 	return new Promise((resolve) => {
 		const request = require('request');
 		request.get({ url: url },
 			(err, response) => {
 				try {
 					if (err) throw 'Error'; 
 					if (!Boolean(response.body)) throw 'No response';
 					let parsed = JSON.parse(response.body);
 					resolve(parsed);
 				} catch(e) {
 					resolve(false);	
 				}
 			});
 	});
 }

 function getLocation(href) {
 	var match = href.match(/^(https?\:)\/\/(([^:\/?#]*)(?:\:([0-9]+))?)([\/]{0,1}[^?#]*)(\?[^#]*|)(#.*|)$/);
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

 function getNodeList(nodeListHost) {
 	return new Promise((resolve) => {
 		try {
 			const location = getLocation(nodeListHost).host;
 			const request = require('request');
 			request.get({	url: nodeListHost + '/nodes/list.json'},
 				(err, response) => {
 					try {
 						if (err) throw 'Error';
 						if (!Boolean(response.body)) throw 'No response';
 						const nodes = JSON.parse(response.body);
 						if (!Boolean(nodes)) throw 'No data';
 						var currentHost;
 						if (typeof window !== 'undefined') currentHost = window.location.hostname;
 						if (Boolean(currentHost)) nodes.unshift(currentHost);
 						const apis = nodes.map(function(api) {
 							return 'http://' + api + ':8008';
 						});
 						if (Boolean(process.env.API_URL)) apis.unshift(process.env.API_URL);
 						let uniqueAPIs = apis.filter(function(value, index, self) { return self.indexOf(value) === index; });
 						uniqueAPIs.sort(function() {	return .5 - Math.random(); });
 						resolve(uniqueAPIs);
 					} catch(e) {
 						resolve([]);
 					}
 				});
 		} catch(e) {
 			resolve([]);
 		}
 	});
 }

 function count(counted, boxes, ballots, privkey) {
 	try {
 		let sum = 0;
 		var ballot, vote;
 		ballots.forEach(function(x) {
 			ballot = x.address;
 			vote = cbor.decode(Buffer.from(x.data, 'base64'));
 			if (Boolean(privkey) && vote.substr(0,2) == 'xx') vote = decryptBallot(privkey, ballot, vote);
 			if (vote.substr(0,2) != 'xx') {
 				counted[vote] = (counted[vote] || 0) + 1;
 				if (Boolean(boxes[vote])) {
 					boxes[vote].push(ballot);
 				} else {
 					boxes[vote] = [ ballot ];
 				}
 			}
 			sum++; 
 		});
 		return { 'counted': counted, 'boxes': boxes, 'sum': sum };
 	} catch(e){
 		return false;
 	}
 }


 async function parseBallots(api, pollId, privkey, boxed) {
 	try {
 		let counted = {};
 		let boxes = {};
 		let parsed = 0;
 		var result, recount;
 		let url = api + '/state?address=' + BITAGORA_PREFIX + pollId + '&limit=1000';
 		while (url) {
 			result = await requestURL(url);
 			if (!Boolean(result)) throw 'Uncountable';
 			recount = count(counted, boxes, result.data, privkey);
 			if (!recount) throw 'Error';
 			counted = recount['counted'];
 			if (boxed) boxes = recount['boxes'];
 			parsed = parsed + recount['sum'];
 			if (Boolean(result.paging.next)) {
 				url = result.paging.next + "&limit=1000";
 			} else {
 				url = null;
 			}		
 		}
 		return({ 'counted': counted, 'boxes': boxes, 'sum': parsed });
 	} catch(e) {
 		return false ;
 	}		
 }

 async function parsePolls(api) {
 	try {
 		let polls = [];
 		var poll, result, decoded;
 		let url = api + '/state?address=' + BITAGORA_PREFIX + 'bbbb' + '&limit=1000';
 		while (url) {
 			result = await requestURL(url);
 			if (!Boolean(result)) throw 'Uncountable';
 			for (var i=0; i<result.data.length; i++) {
 				if (result.data[i]['address'].substr(0,6) == BITAGORA_PREFIX && result.data[i]['address'].substr(6,4) == "bbbb" ) {
 					decoded = cbor.decode(Buffer.from(result.data[i].data, 'base64'));
 					poll = JSON.parse(decoded.poll);
 					polls.push({
 						'id': poll['id'],
 						'starts': new Date(parseInt(poll['starts'])).toDateString(),
 						'ends': new Date(parseInt(poll['ends'])).toDateString(),
 						'question': poll['question'],
 						'votes': (decoded['votes'] || 0)
 					});
 				}
 			}
 			if (Boolean(result.paging.next)) {
 				url = result.paging.next + "&limit=1000";
 			} else {
 				url = null;
 			}		
 		}
 		return(polls);
 	} catch(e) {
 		return false ;
 	}		
 }

 function requestStateFromAPI(api, address, type, opt) {
 	return new Promise((resolve) => {
 		const request = require('request');
 		var url = `${api}/state`;
 		if (Boolean(address)) url = url + "/" + address;
 		if (Boolean(opt) && Boolean(opt['filter'])) url = url +opt['filter'];
 		if (type == 'ballots') {
 			let givePrivkey = null;
 			if (Boolean(opt.privkey)) givePrivkey = opt.privkey;
 			parseBallots(api, opt.id, givePrivkey, true).then((parsed) => {
 				if (parsed) {
 					let obj = { 'ballots': parsed['counted'], 'votes': parsed['sum'], 'boxes': parsed['boxes'] };
 					resolve({ 'status': 'FOUND', 'data': obj });
 				} else {
 					resolve({ 'status': 'UNKNOWN', 'data': null });			
 				}
 			}).catch((e) => {
 				resolve({ 'status': 'ERROR' });
 			});
 		} else if (type == 'polls') {
 			let polls = [];
 			parsePolls(api).then((parsed) => {
 				if (parsed) {
 					resolve({ 'status': 'FOUND', 'polls': parsed });
 				} else {
 					resolve({ 'status': 'UNKNOWN' });
 				}
 			}).catch((e) => {
 				resolve({ 'status': 'ERROR' });
 			});
 		} else {
 			request.get({ url: url },
 				(err, response) => {
 					try {
 						if (err) throw 'Error'; 
 						if (!Boolean(response.body)) throw 'No response';
 						let json = JSON.parse(response.body);
 						if (!Boolean(json.data)) throw 'No data';
 						if (type == 'setting') {
 							resolve({ 'status': 'FOUND', 'data': json.data });
 						} else if (type == 'poll') {
 							let data = cbor.decode(Buffer.from(json.data, 'base64'));
 							if (!Boolean(data) || !Boolean(data.poll)) throw 'No data';
 							let poll = JSON.parse(data.poll);
 							if (poll.open || (!poll.open && !Boolean(poll.privkey)) || (!poll.open && !opt['unbox']) ) {
 								resolve({'status': 'FOUND', 'data': data });					
 							} else {
 								console.log("  This poll is encrypted and contains "+ data['votes'].toLocaleString() + " ballots.");
 								console.log("  Ballots need to be opened and decrypted one by one with the private key.");
 								console.log("  Please be aware that this process will take some time.");
 								console.log("  Opening ballot boxes...");
 								parseBallots(api, poll.id, poll.privkey, true).then((parsed) => {
 									let obj = { 'poll': JSON.stringify(poll), 'ballots': parsed['counted'], 'votes': parsed['sum'], 'boxes': parsed['boxes'] };
 									resolve({ 'status': 'FOUND', 'data': obj });
 								}).catch((e) => {
 									resolve({ 'status': 'ERROR' });
 								});
 							}
 						} else if (type == 'ballot') {
 							let data = cbor.decode(Buffer.from(json.data, 'base64'));
 							if (Boolean(opt) && Boolean(opt.privkey) && data.substr(0,2) == 'xx') {
 								let decrypted = decryptBallot(opt.privkey, address, data);
 								if (decrypted) {
 									resolve({ 'status': 'FOUND', 'data': decrypted  });
 								} else {
 									resolve({ 'status': 'FOUND', 'data': data });
 								}
 							} else {
 								resolve({ 'status': 'FOUND', 'data': data });
 							}
 						} else {
 							throw 'Unknown request';						
 						}
 					} catch(e) {
 						resolve({ 'status': 'ERROR' });
 					}
 				});
 		}
 	});
 }

 async function requestStateFromAPIs(apis, address, type, opt) {
 	try {
 		var number = apis.length;
 		if (number > 10) number = 10;
 		let response = { status: 'UNKNOWN' };
 		for (var i=0; i<number; i++) {
 			let result = await requestStateFromAPI(apis[i], address, type, opt);
 			response = result;
 			if (Boolean(response) && response.status == 'FOUND' ) break;
 		}
 		return response;
 	} catch(e) {
 		return { status: 'ERROR' };
 	}
 }

 function getBallot(ballot, poll, voterPrivkeyHex) {
 	try {
 		if (poll.open) {
 			return ballot;
 		} else {
 			if (Object.keys(poll.values).indexOf(ballot) == -1 ) throw 'Ballot not valid';
 			let encrypted = encryptBallot(ballot, poll.certkey, voterPrivkeyHex);
 			return encrypted;
 		}
 	} catch(e) {
 		return undefined;
 	}
 }

 function requestState(nodeHost, type, pollId, voteId, settingString, pollkey, unbox) {
 	return new Promise((resolve) => {
 		try {
 			var address = '';
 			var opt = null;
 			if (!Boolean(type)) throw 'No type';
 			if (unbox === undefined) unbox = true;
 			if (type == 'setting' && Boolean(settingString)) address = getSettingAddress(settingString);
 			if (type == 'poll' && Boolean(pollId)) {
 				opt = { 'unbox': unbox };
 				address = getPollAddress(pollId);
 			}
 			if (type == 'ballots' && Boolean(pollId)) opt = {'id' : pollId, 'privkey': pollkey }
 				if (type == 'ballot' && Boolean(voteId)) {
 					if (voteId.substr(0,6) == BITAGORA_PREFIX) {
 						address = voteId;
 					} else {
 						address = getVoteAddress(pollId, voteId);
 					}
 					if (Boolean(pollkey)) opt = { 'privkey': pollkey };
 				}
 				if (type != 'polls' && type != 'ballots' && !Boolean(address)) throw 'No address';
 				getNodeList(nodeHost).then((apis) => {
 					if (apis.length > 0) {
 						requestStateFromAPIs(apis, address, type, opt).then((result)=> {
 							resolve(result);
 						});
 					} else {
 						resolve({ 'status': 'UNKNOWN' });
 					}
 				});
 			} catch(e) {
 				resolve({'status': 'ERROR'});
 			}	
 		});
 }

 const AES256CbcEncrypt = (iv, key, plaintext) => {
 	const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
 	const firstChunk = cipher.update(plaintext);
 	const secondChunk = cipher.final();
 	return Buffer.concat([firstChunk, secondChunk]);
 }

 const AES256CbcDecrypt = (iv, key, ciphertext) => {
 	const cipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
 	const firstChunk = cipher.update(ciphertext);
 	const secondChunk = cipher.final();
 	return Buffer.concat([firstChunk, secondChunk]);
 }

 function encryptBallot(ballot, pollPubkey, voterPrivkey) {
 	try {		
 		const plaintext = Buffer.from(ballot, 'hex');
 		const pubPoint = ec.keyFromPublic(pollPubkey, 'hex').getPublic();
 		const pubkey_hex = pubPoint.encode('hex');
 		const pubKey = Buffer.from(pubkey_hex, 'hex');
 		const ephemPrivKey = ec.keyFromPrivate(voterPrivkey);
 		const ephemPubKey = ephemPrivKey.getPublic();
 		const ephemPubKeyEncoded = Buffer.from(ephemPubKey.encode());
 		const px = ephemPrivKey.derive(ec.keyFromPublic(pubKey).getPublic());
 		const hash = crypto.createHash("sha512").update(px.toArrayLike(Buffer)).digest();
 		const iv = crypto.randomBytes(16);
 		const encryptionKey = hash.slice(0, 32);
 		const ciphertext = AES256CbcEncrypt(iv, encryptionKey, plaintext);
 		const serializedCiphertext = Buffer.concat([ iv, ciphertext ]);
 		const voterPubkey = ephemPubKey.encodeCompressed('hex');
 		return "xx" + voterPubkey.substr(voterPubkey.length - 10) + serializedCiphertext.toString('base64');
 	} catch(e) {
 		return false;
 	}
 }

 function decryptBallot(pollPrivkey, address, encryptedString) {
 	try {
 		const voterPubkey = address.substr(14) + encryptedString.substr(2,10);
 		const encrypted = Buffer.from(encryptedString.substr(12), 'base64');
 		const privKey = Buffer.from(pollPrivkey, 'hex');
 		const voterKey = ec.keyFromPublic(voterPubkey, 'hex');
 		const ephemPubKey = voterKey.getPublic();
 		const iv = encrypted.slice(0, 16);
 		const ciphertext = encrypted.slice(16);
 		const px = ec.keyFromPrivate(privKey).derive(ephemPubKey);
 		const hash = crypto.createHash("sha512").update(px.toArrayLike(Buffer)).digest();
 		const encryptionKey = hash.slice(0, 32);
 		const plaintext = AES256CbcDecrypt(iv, encryptionKey, ciphertext);
 		return plaintext.toString('hex');
 	} catch(e) {
 		return false;
 	}
 }

 function decryptBallots(ballots, pollPrivkey) {
 	return new Promise((resolve, reject) => {
 		try {
 			if (!Boolean(ballots)) throw 'No data to decrypt';
 			let decrypted = [];
 			let decVote = '';
 			for (var i=0; i<ballots.length; i++) {
 				decVote = decryptBallot(pollPrivkey, ballots[i].ballot, ballots[i].vote);
 				if (decVote) {
 					decrypted.push({ 'ballot': ballots[i].ballot, 'vote': decVote });
 				} else {
 					throw 'Error in decryption';
 				}
 			}
 			resolve(decrypted);
 		} catch(e) {
 			reject(e);
 		}
 	});
 }
 
 module.exports = {
 	getPollAddress,
 	getVoteAddress,
 	requestState,
 	getVoteToken,
 	getPollToken,
 	getPrechecksumVote,
 	getNodeList,
 	_hash,
 	requestURL,
 	getSettingAddress,
 	encryptBallot,
 	decryptBallot,
 	decryptBallots,
 	getBallot
 }
