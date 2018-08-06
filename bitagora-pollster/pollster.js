/**
 * BITAGORA POLLSTER
 * pollster.js
 * Functions to create, close and approve polls in the Bitagora Platform voting system
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
 	BITAGORA_URL, BITAGORA_POLL_FAMILY, BITAGORA_VERSION, 
 	getPollAddress, requestURL, _hash, getNodeList, getSettingAddress, validatePoll  } = require('bitagora-library');
 	const EC = require('elliptic').ec;
 	var ec = new EC('secp256k1');
 	const { Secp256k1PrivateKey } = require('sawtooth-sdk/signing/secp256k1')
 	const { protobuf } = require('sawtooth-sdk');
 	const { createContext, CryptoFactory } = require('sawtooth-sdk/signing');
 	const signerContext = createContext('secp256k1');

 	function createPoll(api, poll, signer) {
 		return new Promise((resolve) => {
 			try {
 				poll.timestamp = new Date().getTime().toString();
 				var payloadBytes = Buffer.from(JSON.stringify(poll));
 				const transactionHeaderBytes = protobuf.TransactionHeader.encode({
 					familyName: BITAGORA_POLL_FAMILY,
 					familyVersion: BITAGORA_VERSION,
 					inputs: [getPollAddress(poll.id), getSettingAddress('sawtooth.settings.vote.authorized_keys')],
 					outputs: [getPollAddress(poll.id)],
 					signerPublicKey: signer.getPublicKey().asHex(),
 					batcherPublicKey: signer.getPublicKey().asHex(),
 					dependencies: [],
 					payloadSha512: _hash('sha512', payloadBytes)
 				}).finish();
 				const signature = signer.sign(transactionHeaderBytes);
 				const transaction = protobuf.Transaction.create({
 					header: transactionHeaderBytes,
 					headerSignature: signature,
 					payload: payloadBytes
 				});
 				const transactions = [transaction];
 				const batchHeaderBytes = protobuf.BatchHeader.encode({
 					signerPublicKey: signer.getPublicKey().asHex(),
 					transactionIds: transactions.map((txn) => txn.headerSignature)
 				}).finish();
 				const batchSignature = signer.sign(batchHeaderBytes);
 				const batch = protobuf.Batch.create({
 					header: batchHeaderBytes,
 					headerSignature: batchSignature,
 					transactions: transactions
 				});
 				const batchListBytes = protobuf.BatchList.encode({
 					batches: [batch]
 				}).finish()
 				const request = require('request');
 				request.post({
 					url: `${api}/batches`,
 					body: batchListBytes,
 					headers: {
 						'Content-Type': 'application/octet-stream'
 					}
 				},
 				(err, response) => {
 					try {
 						if (err) throw err;
 						if (!Boolean(response.body)) throw 'No response';
 						if (response.statusCode != 200 && response.statusCode != 201 && response.statusCode != 202) throw 'Failed request';
 						let link = JSON.parse(response.body)['link'];
 						requestURL(link).then((result) => {
 							if (Boolean(result) && Boolean(result.data)) {
 								resolve(result.data[0]);
 							} else {
 								resolve({ status: "ERROR" });
 							}
 						}).catch((e) => {
 							console.log(e);
 							resolve({ status: "ERROR" });
 						});
 					} catch(e) {
 						console.log(e);
 						resolve({ status: "ERROR" });
 					}
 				});
 			} catch(e) {
 				console.log(e);
 				resolve({ status: "ERROR" });
 			}
 		});
 	}

 	function closePoll(api, poll, signer, privkey) {
 		return new Promise((resolve) => {
 			try {
 				let obj = {
 					'id': poll.id,
 					'privkey': privkey,
 					'certkey': poll.certkey,
 					'timestamp': new Date().getTime().toString()
 				}
 				var payloadBytes = Buffer.from(JSON.stringify(obj));
 				const transactionHeaderBytes = protobuf.TransactionHeader.encode({
 					familyName: BITAGORA_POLL_FAMILY,
 					familyVersion: BITAGORA_VERSION,
 					inputs: [getPollAddress(poll.id), getSettingAddress('sawtooth.settings.vote.authorized_keys')],
 					outputs: [getPollAddress(poll.id)],
 					signerPublicKey: signer.getPublicKey().asHex(),
 					batcherPublicKey: signer.getPublicKey().asHex(),
 					dependencies: [],
 					payloadSha512: _hash('sha512', payloadBytes)
 				}).finish();
 				const signature = signer.sign(transactionHeaderBytes);
 				const transaction = protobuf.Transaction.create({
 					header: transactionHeaderBytes,
 					headerSignature: signature,
 					payload: payloadBytes
 				});
 				const transactions = [transaction];
 				const batchHeaderBytes = protobuf.BatchHeader.encode({
 					signerPublicKey: signer.getPublicKey().asHex(),
 					transactionIds: transactions.map((txn) => txn.headerSignature)
 				}).finish();
 				const batchSignature = signer.sign(batchHeaderBytes);
 				const batch = protobuf.Batch.create({
 					header: batchHeaderBytes,
 					headerSignature: batchSignature,
 					transactions: transactions
 				});
 				const batchListBytes = protobuf.BatchList.encode({
 					batches: [batch]
 				}).finish()
 				const request = require('request');
 				request.post({
 					url: `${api}/batches`,
 					body: batchListBytes,
 					headers: { 
 						'Content-Type': 'application/octet-stream', 
 					}
 				},
 				(err, response) => {
 					try {
 						if (err) throw err;
 						if (!Boolean(response.body)) throw 'No response';
 						if (response.statusCode != 200 && response.statusCode != 201 && response.statusCode != 202) throw 'Failed request';
 						let link = JSON.parse(response.body)['link'];
 						requestURL(link).then((result) => {
 							if (Boolean(result) && Boolean(result.data)) {
 								resolve(result.data[0]);
 							} else {
 								resolve({ status: "ERROR" });
 							}
 						}).catch((e) => {
 							console.log(e);
 							resolve({ status: "ERROR" });
 						});
 					} catch(e) {
 						console.log(e);
 						resolve({ status: "ERROR" });
 					}
 				});
 			} catch(e) {
 				console.log(e);
 				resolve({ status: "ERROR" });
 			}
 		});
 	}

 	async function submitPolltoAPIs(apis, poll, signer, action, key) {
 		try {
 			if (action != 'create' && action != 'close') return false;
 			var number = 10;
 			if (apis.length < 10) 	number = apis.length;
 			var link;
 			let response = { status: 'UNKNOWN' };
 			for (var i=0; i<number; i++) {
 				try {
 					var result;
 					if (action == 'create') { 
 						result = await createPoll(apis[i], poll, signer);
 					} else if (action == 'close') {
 						result = await closePoll(apis[i], poll, signer, key);
 					} 
 					response = result;
 					if (Boolean(response)) {
 						if ( response.status == 'COMMITTED' ) {
 							break;
 						} else if ( response.status == 'PENDING' ) {
 							link = apis[i] + "/batch_statuses?id=" + response.id;
 							response = await confirmSubmission(link);
 							console.log("Response from confirmation");
 							console.log(response);
 							if (Boolean(response) && Boolean(response.status))  {
 								if (response.status == 'INVALID' && response.invalid_transactions[0].message.indexOf("Poll already exists") != -1) {
 									console.log("Changing to committed");
 									response['status'] = 'COMMITTED';
 								}
 								if (response.status == 'COMMITTED') break;
 							}
 						} else if (response.status == 'INVALID' ) {
 							throw response;
 						} 
 					}
 				} catch(e) {
 					if (e.status == 'INVALID') break;
 				}
 			}
 			console.log("Returning");
 			console.log(response);
 			return response;
 		} catch(e) {
 			console.log(e);
 			return { status: 'ERROR' };
 		}
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
 			while (attempts < 20) {
 				response = await requestURL(link);
 				if (response.data[0].status == "COMMITTED" || response.data[0].status == "INVALID" ) break;
 				wait(5000 + attempts * 1000);
 				attempts = attempts + 1;
 			}
 			return(response.data[0]);
 		} catch(e) {
 			console.log(e);
 			return { status: 'UNKNOWN' };
 		}
 	}

 	function create(poll, pollsterPrivkey) {
 		return new Promise((resolve, reject) => {
 			try {
 				if (!Boolean(poll)) throw 'No poll';
 				if (!Boolean(pollsterPrivkey)) throw 'No pollster key';
 				if (poll.certkey.substr(poll.certkey.length-8) !== poll.id) throw 'Poll id is incorrect';
 				const privateKey = Secp256k1PrivateKey.fromHex(pollsterPrivkey);
 				const signerContext = createContext('secp256k1');
 				const factory = new CryptoFactory(signerContext);
 				const signer = factory.newSigner(privateKey);
 				const pubkeyHex = signerContext.getPublicKey(privateKey).asHex();
 				if (poll.certkey !== pubkeyHex) throw 'Pollster key is not valid';
 				validatePoll(poll).then((valid) => {
 					try {
 						if (!valid) throw 'Poll is not valid';
 						getNodeList(BITAGORA_URL).then((APIs) => {
 							try {
 								if (!Boolean(APIs) || APIs.length == 0) throw 'No APIs';
 								submitPolltoAPIs(APIs, poll, signer, 'create', pollsterPrivkey).then((result) => {
 									if (result.status == 'COMMITTED' || result.status == 'INVALID') {
 										resolve(result);
 									} else {
 										reject(result);
 									}
 								}).catch((e) => {
 									console.log(e);
 									reject(e);
 								});
 							} catch(e) {
 								console.log(e);
 								reject(e);
 							}
 						}).catch((e) => {
 							console.log(e);
 							reject(e);
 						});
 					} catch(e) {
 						console.log(e);
 						reject(e);			
 					}
 				}).catch((e) => {
 					console.log(e);
 					reject(e);
 				});
 			} catch(e) {
 				console.log(e);
 				reject(e);
 			}
 		});
 	}

 	function close(poll, pollsterPrivkey) {
 		return new Promise((resolve, reject) => {
 			try {
 				if (!Boolean(poll)) throw 'No poll';
 				if (!Boolean(pollsterPrivkey)) throw 'No pollster privkey';
 				const signerContext = createContext('secp256k1');						
 				const factory = new CryptoFactory(signerContext);
 				const privateKey = Secp256k1PrivateKey.fromHex(pollsterPrivkey);
 				const signer = factory.newSigner(privateKey);
 				const pubkeyHex = signerContext.getPublicKey(privateKey).asHex();
 				if (pubkeyHex !==poll.certkey) throw 'Invalid keys'; 
 				getNodeList(BITAGORA_URL).then((APIs) => {
 					try { 
 						if (!Boolean(APIs) || APIs.length == 0) throw 'No APIs';
 						submitPolltoAPIs(APIs, poll, signer, 'close', pollsterPrivkey).then((result) => {
 							if (result.status == 'COMMITTED' || result.status == 'INVALID') {
 								resolve(result);
 							} else {
 								reject(result);
 							}
 						}).catch((e) => {
 							console.log(e);
 							reject(e);
 						});
 					} catch(e) {
 						console.log(e);
 						reject(e);
 					}
 				}).catch((e) => {
 					console.log(e);
 					reject(e);
 				});
 			} catch(e) {
 				console.log(e);
 				reject(e);
 			}
 		});
 	}

 	function approve(poll, adminPrivkeyHex) {
 		return new Promise((resolve, reject) => {
 			try {
 				if (!Boolean(poll.certkey)) throw 'No certkey';
 				let token = _hash('sha256',_hash('sha256', getPollToken(poll)));
 				let adminKey = ec.keyFromPrivate(adminPrivkeyHex);
 				let signature = adminKey.sign(token);
 				let approval = signature.toDER('hex');
 				resolve(approval);
 			} catch(e) {
 				console.log(e);
 				reject(false);
 			}
 		});
 	}

 	module.exports = {
 		create,
 		close,
 		approve
 	}
