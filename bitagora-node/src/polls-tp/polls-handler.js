/**
 * BITAGORA NODE
 * polls-handler.js
 * Handler for poll transactions in Bitagora Platform voting system
 * Developed by Ignasi Ribó, 2018
 * Repo: https://github.com/bitagora/bitagora-core
 * 
 * Based on Hyperledger/Sawtooth
 * Copyright 2018 Intel Corporation
 * https://github.com/hyperledger/sawtooth-core
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
 const { BITAGORA_PREFIX, BITAGORA_POLL_FAMILY, BITAGORA_VERSION, PollState, validatePoll } = require('bitagora-library');
 const { TransactionHandler } = require('sawtooth-sdk/processor/handler');
 const { InvalidTransaction } = require('sawtooth-sdk/processor/exceptions');

 const _parsePoll = (buffer, pollState, signerPubkey) =>
 new Promise(function(resolve, reject) {
 	try {
 		let poll = JSON.parse(buffer);
 		if (!Boolean(poll)) throw 'Failed to parse vote';
 		validatePoll(poll)
 		.then((valid) => {
 			try {
 				if (!valid) throw 'Invalid Poll: Poll is not valid';
 				if ( signerPubkey != poll.certkey ) throw 'Invalid Signer: Pollster is not authorized';
 				pollState.getSetting('sawtooth.settings.vote.authorized_keys')
 				.then((authorized) => {
 					try {
 						if (Boolean(poll.privkey)) {
 							resolve(poll);
 						} else {
 							let authorizedArray = authorized.split(",");
 							if (authorizedArray.indexOf(poll.adminkey) === -1) throw 'Invalid Poll: Admin is not authorized';
 							resolve(poll);
 						}
 					} catch(e) {
 						reject(e);
 					}
 				}).catch((e) => {
 					reject(e);
 				});
 			} catch(e) {
 				reject(e);
 			}
 		}).catch((e) => {
 			reject(e);
 		});
 	} catch(e) {
 		reject(e);
 	}
 });

 class PollsHandler extends TransactionHandler {
 	constructor () {
 		super(BITAGORA_POLL_FAMILY, [BITAGORA_VERSION], [BITAGORA_PREFIX], 'application/protobuf');
 	}
 	
 	apply (transactionProcessRequest, context) {
 		try {
 			let pollState = new PollState(context);
 			let header = transactionProcessRequest.header;
 			let signer = header.signerPublicKey;
 			return _parsePoll(transactionProcessRequest.payload, pollState, signer)
 			.then((poll) => {
 				try {
 					return pollState.getPoll(poll.id)
 					.then((pollInState) => {
 						try {
 							if (Boolean(pollInState) && Boolean(pollInState.privkey)) throw 'Invalid Action: Poll already closed';
 							if (!Boolean(poll.privkey) && Boolean(pollInState)) throw 'Invalid Action: Poll already exists';
 							if (Boolean(poll.privkey) && !Boolean(pollInState)) throw 'Invalid Action: Poll does not exist';
 							if (Boolean(poll.privkey)) {
 								console.log("Closing poll: ");
 								console.log(poll);
 								return pollState.closePoll(poll);
 							} else {
 								console.log("Creating poll: ");
 								console.log(poll);
 								return pollState.setPoll(poll);
 							}
 						} catch(e) {
 							console.log(e);
 							return Promise.resolve().then(() => {
 								throw new InvalidTransaction(e);
 							});
 						}
 					}).catch((e) => {
 						console.log(e);
 						return Promise.resolve().then(() => {
 							throw new InvalidTransaction(e);
 						});
 					});
 				} catch(e) {
 					console.log(e);
 					return Promise.resolve().then(() => {
 						throw new InvalidTransaction(e);
 					});
 				}
 			}).catch((e) => {
 				console.log(e);
 				return Promise.resolve().then(() => {
 					throw new InvalidTransaction(e);
 				});
 			});
 		} catch(e) {
 			console.log(e);
 			return Promise.resolve().then(() => {
 				throw new InvalidTransaction(e);
 			});
 		}
 	}
 }

 module.exports = {
 	PollsHandler
 }