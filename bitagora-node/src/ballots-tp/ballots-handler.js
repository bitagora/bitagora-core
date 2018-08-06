/**
 * BITAGORA NODE
 * ballots-handler.js
 * Handler for ballot transactions in Bitagora Platform voting system
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
 const { BITAGORA_PREFIX, BITAGORA_FAMILY, BITAGORA_VERSION, PollState, validateVote } = require('bitagora-library');
 const { TransactionHandler } = require('sawtooth-sdk/processor/handler');
 const { InvalidTransaction } = require('sawtooth-sdk/processor/exceptions');

 const _parseVote = (buffer, pollState) =>
 new Promise(function(resolve, reject) {
 	try {
 		let vote = JSON.parse(buffer);
 		if (vote === undefined || vote.poll === undefined) throw "Failed to parse vote";
 		pollState.getPoll(vote.poll).then(
 			(poll) => {
 				if (poll === undefined) throw 'Invalid Action: Poll not found';
 				if (Boolean(poll.privkey)) throw 'Invalid Action: Poll already closed';
 				validateVote(vote, poll).then((result) => { 
 					if (result) {
 						resolve([poll, vote]);
 					} else {
 						reject('Invalid Action: Vote is not valid');
 					}
 				}).catch((e) => {
 					reject(e);
 				});
 			}).catch((e) => {
 				reject(e);
 			});
 		} catch(e) {
 			reject(e);
 		}
 	});

 class BallotsHandler extends TransactionHandler {

 	constructor () {
 		super(BITAGORA_FAMILY, [BITAGORA_VERSION], [BITAGORA_PREFIX], 'application/protobuf');
 	}

 	apply (transactionProcessRequest, context) {
 		let pollState = new PollState(context);
 		return _parseVote(transactionProcessRequest.payload, pollState)
 		.then((response) => {
 			try {
 				let poll = response[0];
 				let vote = response[1];
 				let header = transactionProcessRequest.header;
 				let voter = header.signerPublicKey;
 				if (vote.id != voter) throw 'Invalid Action: Vote id does not correspond to voter';
 				return pollState.getBallot(poll, vote)
 				.then((ballot) => {
 					try {
 						if (ballot !== undefined) throw 'Invalid Action: Vote already cast';
 						console.log("Setting ballot: " + JSON.stringify(vote));
 						return pollState.setBallot(poll, vote);
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
 	}
 }

 module.exports = {
 	BallotsHandler
 }