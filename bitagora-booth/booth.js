/**
 * BITAGORA BOOTH
 * booth.js
 * Vote, check and count ballots in the Bitagora Platform voting system
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
 const { 
 	BITAGORA_URL, BITAGORA_PREFIX, BITAGORA_FAMILY, BITAGORA_VERSION,
 	getPollAddress, getPrechecksumVote, requestState, getNodeList, _hash, requestURL, getBallot, getVoteAddress,
 	validateVote } = require('bitagora-library');
 	const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
 	const Bs58 = require('base-x')(BASE58);

 	const { createContext, CryptoFactory } = require('sawtooth-sdk/signing');
 	const {  Secp256k1PrivateKey } = require('sawtooth-sdk/signing/secp256k1');

 	const protobuf = require('protobufjs');
 	const root = protobuf.Root.fromJSON(require('./protobuf_bundle.json'));
 	const TransactionHeader = root.lookup('TransactionHeader');
 	const Transaction = root.lookup('Transaction');
 	const Batch = root.lookup('Batch');
 	const BatchHeader = root.lookup('BatchHeader');
 	const BatchList = root.lookup('BatchList');

 	class Vote {
 		constructor(data, poll) {
 			this.prefix = BITAGORA_PREFIX,
 			this.id = data.id,
 			this.date = data.date,   
 			this.poll = poll.id,
 			this.ballot = getBallot(data.ballot, poll, Bs58.decode(data.privkey).toString('hex')),
 			this.checksum = _hash('sha256',getPrechecksumVote(this)).substr(0,4),
 			this.certsig = data.certsig
 			this.timestamp = ''
 		}
 	}

 	function postVote(voteBytes,url) {
 		return new Promise(function(resolve, reject) {
 			const request = require('request');
 			request.post({
 				url: url+'/batches',
 				body: voteBytes,
 				headers: { 
 					'Content-Type': 'application/octet-stream'
 				},
 				timeout: 2000
 			}, 
 			(err, response) => {
 				try {
 					if (err) {
 						console.log(err);
 						reject(err);
 					} else {
 						if (response.statusCode == 200 || response.statusCode == 201 || response.statusCode == 202) {
 							let link = JSON.parse(response.body)['link'];
 							requestURL(link).then((result) => {
 								if (Boolean(result) && Boolean(result.data)) {
 									resolve(result.data[0]);
 								} else {
 									reject(false);	
 								}
 							}).catch((e) => {
 								reject(e);
 							});
 						} else {
 							reject(response.body);
 						}
 					}
 				} catch(e) {
 					console.log(e);
 					reject(e);
 				}
 			});
 		});
 	}

 	function getVoteBytes(vote, signer, poll) {
 		return new Promise((resolve) => {
 			try {
 				vote.timestamp = new Date().getTime().toString();
 				var payloadBytes = Buffer.from(JSON.stringify(vote));
 				const transactionHeaderBytes = TransactionHeader.encode({
 					familyName: BITAGORA_FAMILY,
 					familyVersion: BITAGORA_VERSION,
 					inputs: [getVoteAddress(poll.id, vote.id), getPollAddress(poll.id)],
 					outputs: [getVoteAddress(poll.id, vote.id), getPollAddress(poll.id)],
 					signerPublicKey: vote.id,
 					batcherPublicKey: vote.id,
 					dependencies: [],
 					payloadSha512: _hash('sha512', payloadBytes)
 				}).finish();
 				const signature = signer.sign(transactionHeaderBytes);
 				const transaction = Transaction.create({
 					header: transactionHeaderBytes,
 					headerSignature: signature,
 					payload: payloadBytes
 				});
 				const transactions = [transaction];
 				const batchHeaderBytes = BatchHeader.encode({
 					signerPublicKey: vote.id,
 					transactionIds: transactions.map((txn) => txn.headerSignature)
 				}).finish();
 				const batchSignature = signer.sign(batchHeaderBytes);
 				const batch = Batch.create({
 					header: batchHeaderBytes,
 					headerSignature: batchSignature,
 					transactions: transactions
 				});
 				const batchListBytes = BatchList.encode({
 					batches: [batch]
 				}).finish();
 				resolve(batchListBytes);
 			} catch(e) {
 				console.log(e);
 				resolve(false);
 			}
 		});
 	}

 	function fetchVote(data) {
 		return new Promise((resolve) => {
 			try {	   
 				if (!Boolean(data['id'])) {
 					if (Boolean(data['privkey'])) {
 						const privkey_hex = Bs58.decode(data['privkey']).toString('hex');
 						const privateKey = Secp256k1PrivateKey.fromHex(privkey_hex);
 						const signerContext = createContext('secp256k1');
 						data['id'] = signerContext.getPublicKey(privateKey).asHex();
 					}
 				}
 				if (!Boolean(data['poll']) || !Boolean(data['id'])) throw 'No data';
 				requestState(BITAGORA_URL, 'ballot', data['poll'], data['id'], null, null).then((result) => {
 					resolve(result);		
 				}).catch((e) => {
 					console.log(e);
 					resolve({status: 'UNKNOWN' });
 				});
 			} catch(e) {
 				console.log(e);
 				resolve({status: 'UNKNOWN' });
 			}
 		});
 	}

 	function wait(ms){
 		var start = new Date().getTime();
 		var end = start;
 		while(end < start + ms) {
 			end = new Date().getTime();
 		}
 	}


 	async function confirmSubmission(link) {
 		try {
 			let attempts = 0;
 			var response;
 			while (attempts < 3) {
 				response = await requestURL(link);
 				if (response.data[0].status == "COMMITTED" || response.data[0].status == "INVALID") break;
 				wait(2000 + attempts * 1000);
 				attempts = attempts + 1;
 			}
 			return(response);
 		} catch(e) {
 			return { status: 'UNKNOWN' };
 		}
 	}

 	async function sendVoteToAPIs(bytes, apis) {
 		try {
 			let response = { status: 'ERROR', code: '', message: '' };
 			var link;
 			for (var i=0; i<apis.length; i++) {
 				let result = await postVote(bytes, apis[i]).catch((e) => {
 					console.log(e);
 					try { 
 						let error = JSON.parse(e); 
 						if (Boolean(error['error']) && Boolean(error['error']['code'])) {
 							response['code'] = error['error']['code'];
 							response['message'] = error['error']['message'];
 						}
 					} catch(err) { console.log(err); }
 					return false;
 				});
 				if (result) {
 					if ( result.status == 'COMMITTED' ) {
 						response = result;
 						break;
 					} else if ( result.status == 'PENDING' ) {
 						link = apis[i] + "/batch_statuses?id=" + result.id;
 						response = await confirmSubmission(link).catch((e) => { return { status: 'ERROR', code: '', message: e } });
 						if (Boolean(response) && Boolean(response.status)) {
 							if (response.status == 'COMMITTED') break;
 							if (response.status == 'INVALID') throw response;
 						}
 					} else if (result.status == 'INVALID' ) {
 						throw result;
 					} 
 				}
 			}
 			return response;
 		} catch(e) {
 			console.log(e);
 			if (Boolean(e.status) && e.status == 'INVALID') {	  					
 				return e;
 			} else {
 				return { status: 'ERROR', code: '', message: e };	  	
 			}
 		}
 	}

 	function vote(ballot, context) {
 		return new Promise((resolve) => {
 			try {
 				if (!Boolean(ballot) || !Boolean(context)) throw 'No data';
 				var newVote = new Vote(ballot, context.poll);
 				if (!newVote.ballot) throw 'Ballot is not valid';
 				var privkey_hex = Bs58.decode(ballot.privkey).toString('hex');
 				const privateKey = Secp256k1PrivateKey.fromHex(privkey_hex);
 				const signerContext = createContext('secp256k1');
 				const factory = new CryptoFactory(signerContext);
 				const signer = factory.newSigner(privateKey);
 				const pubkey_hex = signerContext.getPublicKey(privateKey).asHex();
 				if (pubkey_hex != newVote.id) throw 'Vote is not valid';
 				validateVote(newVote, context.poll).then((valid) => {
 					try {
 						if (!valid) throw 'Vote is not valid';
 						requestState(BITAGORA_URL, 'poll', context.poll.id, null, null).then((respState) => {
 							try {
 								if (!Boolean(respState) || respState.status != "FOUND" ) throw 'No state';
 								getNodeList(BITAGORA_URL).then((APIs) => {
 									try {
 										if (!Boolean(APIs)) APIs = [];
 										if (Boolean(context.nodeSeed)) APIs.concat(context.nodeSeed);
 										let uniqueAPIs = APIs.filter(function(value, index, self) { return self.indexOf(value) === index; });
 										if (!Boolean(uniqueAPIs) || uniqueAPIs.length == 0) throw 'No APIs';
 										getVoteBytes(newVote, signer, context.poll).then((bytes) => {
 											try {
 												if (!bytes)  throw 'No bytes to send';
 												sendVoteToAPIs(bytes, uniqueAPIs).then((result) => {
 													resolve(result);
 												}).catch((e) => {
 													console.log(e);
 													resolve({ status: 'ERROR' });
 												});
 											} catch(e) {
 												console.log(e);
 												resolve({ status: 'ERROR' });
 											}
 										}).catch((e) => {
 											console.log(e);
 											resolve({ status: 'ERROR' });
 										});
 									} catch(e) {
 										console.log(e);
 										resolve({ status: 'ERROR' });
 									}
 								}).catch((e) => {
 									console.log(e);
 									resolve({ status: 'ERROR' });						
 								});
 							} catch(e) {
 								console.log(e);
 								resolve({ status: 'ERROR' });
 							}
 						}).catch((e) => {
 							console.log(e);
 							resolve({ status: 'ERROR' });
 						});
 					} catch(e) {
 						console.log(e);
 						resolve({ status: 'ERROR' });
 					}
 				}).catch((e) => {
 					console.log(e);
 					resolve({ status: 'ERROR' });
 				});
 			} catch(e) {
 				console.log(e);
 				resolve({ status: 'ERROR' });
 			}
 		});
 	}

 	function check(data) {
 		return new Promise((resolve) => {
 			try {
 				if (!Boolean(data)) throw 'No data';
 				if (!Boolean(data.poll)) throw 'No poll';
 				if (!Boolean(data.id) && !Boolean(data.privkey)) throw 'No privkey';
 				fetchVote(data).then((result) => {
 					resolve(result);
 				}).catch((e) => {
 					console.log(e);
 					resolve(false);
 				});
 			} catch(e) {
 				console.log(e);
 				resolve(false);
 			}
 		});
 	};

 	function recount(pollId) {
 		return new Promise((resolve) => {
 			try {
 				if (!Boolean(pollId)) throw 'No poll id';
 				requestState(BITAGORA_URL, 'poll', pollId, null, null).then((result) => {
 					resolve(result);		
 				}).catch((e) => {
 					console.log(e);
 					resolve({status: 'ERROR' });
 				});
 			} catch(e) {
 				console.log(e);
 				resolve({status: 'ERROR' });
 			}
 		});
 	};

 	module.exports = {
 		vote,
 		check,
 		recount
 	}

