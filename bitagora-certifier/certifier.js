/**
 * BITAGORA CERTIFIER
 * certifier.js
 * Functions run by the AWS lambda handler in the Bitagora Certifier implementation of the voter registration system
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
 const { create, close } = require('bitagora-pollster');
 const BITAGORA_PREFIX = 'cc0110';
 const crypto = require('crypto');
 const EC = require('elliptic').ec;
 var ec = new EC('secp256k1');
 const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
 const Bs58 = require('base-x')(BASE58);

 const _hash = (sha, x) => crypto.createHash(sha).update(x).digest('hex').toLowerCase();

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

 function getPrechecksumVote(vote) {
 	return vote.prefix + vote.id + vote.date + vote.poll;
 }

 function generateKeys(context) {
 	try {
 		let certKey = ec.genKeyPair();
 		context['privkey'] = certKey.getPrivate('hex');
 		context['poll']['certkey'] =  certKey.getPublic().encodeCompressed('hex');
 		context['poll']['id'] = context['poll']['certkey'].substr(context['poll']['certkey'].length - 8);
 		context['secret'] = crypto.randomBytes(32).toString('hex');
 		if (!Boolean(context['poll']['certkey'])) throw 'Unable to generate certkey';
 		if (!Boolean(context['privkey'])) throw 'Unable to generate privkey';
 		if (!Boolean(context['secret'])) throw 'Unable to generate secret';
 		if (!Boolean(context['poll']['id'])) throw 'Unable to generate id';
 		return(context);
 	} catch(e) {
 		reject(false);
 	}	
 }

 function approvePoll(adminPrivkeyHex, context) {
 	try {
 		if (!Boolean(adminPrivkeyHex)) throw 'No admin key';
 		let token = _hash('sha256',_hash('sha256', getPollToken(context['poll'])));
 		let adminKey = ec.keyFromPrivate(adminPrivkeyHex);
 		let signature = adminKey.sign(token);
 		context['poll']['approval'] = signature.toDER('hex');
 		return context;
 	} catch(e) {
 		reject(false);
 	}
 }


 function processVoter(idcode, context) {
 	return new Promise((resolve, reject) => {
 		try {
 			if (!Boolean(context['privkey']) || !Boolean(context['secret'])) throw 'No private key or secret';
 			let certKey = ec.keyFromPrivate(context['privkey']);
 			let voterPrivkeyHex =  context['privkey'] + context['poll']['id']+ idcode + context['secret'];
 			for (var i=0; i<11; i++) {
 				voterPrivkeyHex = _hash('sha256', voterPrivkeyHex);
 			}
 			let voterKey = ec.keyFromPrivate(voterPrivkeyHex);
 			let d = new Date();
 			let vote = {
 				prefix: BITAGORA_PREFIX,
 				id: voterKey.getPublic().encodeCompressed('hex'),
 				date:  d.getFullYear().toString() + ("0"+(d.getMonth()+1)).slice(-2).toString() + ("0" + d.getDate()).slice(-2).toString(),
 				poll: context['poll']['id']
 			}
 			vote['checksum'] = _hash('sha256',getPrechecksumVote(vote)).substr(0,4);
 			let registration = {
 				privkey: Bs58.encode(Buffer.from(voterPrivkeyHex, 'hex')),
 				id: vote.id,
 				certsig: certKey.sign(getVoteToken(vote)).toDER('hex'),
 				date: vote.date
 			}
 			resolve(registration);
 		} catch(e) {
 			reject(e);
 		}
 	});
 }

 function registerVoter(pollId, id, context, validator) {
 	return new Promise((resolve) => {
 		try {
 			const { validId } = require('./validators/'+validator);
 			if (!Boolean(id)) throw 'No id';
 			if (!Boolean(pollId)) throw 'No poll id';
 			if (context['poll']['id'] !== pollId) throw 'Wrong poll id';
 			if (!validId) throw 'Id is not valid';
 			processVoter(id, context).then((voter) => {
 				try {
 					if (Boolean(voter) && 
 						Boolean(voter.privkey) &&
 						Boolean(voter.certsig) &&
 						Boolean(voter.certsig) &&
 						Boolean(voter.id) && 
 						Boolean(voter.date)) 
 					{
 						resolve(voter);
 					} else {
 						throw 'Error';
 					}
 				} catch(e) {
 					resolve(null);
 				}
 			}).catch((e) => {
 				resolve(null);	
 			});
 		} catch(e) {
 			resolve(null);	
 		}
 	});
 }

 function closePoll(adminPrivkey, context) {
 	return new Promise((resolve) => {
 		try {
 			if (!Boolean(adminPrivkey)) throw 'No admin key';
 			if (!Boolean(context) || !Boolean(context['privkey'])) throw 'Poll has not been set';
 			let adminKey = ec.keyFromPrivate(adminPrivkey);
 			if (adminKey.getPublic().encodeCompressed('hex') !== context['poll']['adminkey'] ) throw 'Wrong admin key';
 			close(context['poll'], context['privkey']).then((closed) => {
 				let privkey = context['privkey'];
 				if (closed.status == 'COMMITTED') {
 					context['privkey'] = null;
 					context['secret'] = null;
 				}
 				resolve({ status: closed.status, context: context, response: privkey });
 			}).catch((e) => {
 				resolve({ status: 'ERROR', response:  'Failed to close poll'  });
 			});
 		} catch(e) {
 			resolve({ status: 'ERROR', response: 'Failed to close poll' });
 		}
 	});
 }

 function createPoll(adminPrivkey, context) {
 	return new Promise((resolve) => {
 		try {
 			if (!Boolean(adminPrivkey)) throw 'No admin key';
 			if (Boolean(context['privkey'])) throw 'Poll already exists';
 			let adminKey = ec.keyFromPrivate(adminPrivkey);
 			if (adminKey.getPublic().encodeCompressed('hex') !== context['poll']['adminkey'] ) throw 'Wrong admin key';
 			context = generateKeys(context);
 			if (!Boolean(context)) throw 'Poll data not registered';
 			context = approvePoll(adminPrivkey, context)
 			if (!Boolean(context)) throw 'Unable to approve';
 			create(context['poll'], context['privkey']).then((created) => {
 				resolve({ status: created.status, context: context, response: context['poll'] });
 			}).catch((e) => {
 				resolve({ status: 'ERROR', response: 'Failed to create poll' });	
 			});
 		} catch(e) {
 			resolve({ status: 'ERROR', response: 'Failed to create poll' });	
 		}
 	});
 }

 module.exports = {
 	createPoll, 
 	closePoll,  
 	registerVoter 
 }