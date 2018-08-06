/**
 * BITAGORA LIBRARY
 * validate.js
 * Shared validation functions for Bitagora Platform JS modules
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

 'use strict';
 const { BITAGORA_PREFIX } = require('./constants');
 const { _hash, getVoteToken, getPollToken, getPrechecksumVote } = require('./functions');
 const EC = require('elliptic').ec;
 var ec = new EC('secp256k1');
 const today = new Date();

 function validatePoll(poll) {
 	return new Promise((resolve) => {
 		try {
 			if (poll.id.length != 8) throw 'Wrong poll id';
 			if (Boolean(poll.privkey)) {
 				var pubPoint = ec.keyFromPrivate(poll.privkey, 'hex').getPublic();
 				var x = pubPoint.encodeCompressed('hex');
 				if ( x.substr(x.length - 8) != poll.id) throw 'Wrong privkey';
 				resolve(true);
 			} else {
 				if (!Boolean(poll.question)) throw 'No question';
 				if (!Boolean(poll.values)) throw 'No values';
 				if (!Boolean(Object.keys(poll.values))) throw 'Wrong value keys';
 				if (!Boolean(Object.values(poll.values))) throw 'Wrong values';
 				if (Object.keys(poll.values).length != Object.values(poll.values).length) throw 'Wrong values';
 				if (parseInt(poll.starts) < today.valueOf() || parseInt(poll.ends) < today.valueOf() || parseInt(poll.starts) > parseInt(poll.ends) ) throw 'Wrong dates';
 				if (!Boolean(poll.certkey)) throw 'No certkey';
 				if (!Boolean(poll.approval)) throw 'No approval';
 				if (!Boolean(poll.adminkey)) throw 'No adminkey';
 				var key = ec.keyFromPublic(poll.adminkey, 'hex');
 				var certScript = _hash('sha256',_hash('sha256', getPollToken(poll)));
 				var verification = key.verify(certScript, poll.approval);
 				resolve(verification);
 			}
 		} catch(e) {
 			console.log(e);
 			resolve(false);
 		}
 	});
 }

 function validateCertSig(vote, certKey) {
 	try {
 		if (!Boolean(certKey)) throw 'No key';
 		var key = ec.keyFromPublic(certKey, 'hex');
 		var payload = getVoteToken(vote);
 		var certScript = _hash('sha256',_hash('sha256',payload));
 		return key.verify(certScript, vote.certsig);
 	} catch(e) {
 		console.log(e);
 		return false;
 	}
 }
 
 function validateVote (vote, poll) {
 	return new Promise((resolve) => {
 		try {
 			
 			if (vote.prefix != BITAGORA_PREFIX) throw 'Wrong prefix';
 			let date = new Date(vote.date.substr(0,4)+"/"+vote.date.substr(4,2)+"/"+vote.date.substr(6,2)).valueOf();
 			if ( date < parseInt(poll.starts)) throw 'Poll has not started';
 			if ( parseInt(vote.timestamp) < parseInt(poll.starts)) throw 'Poll has not started';
 			if ( date > parseInt(poll.ends)) throw 'Poll has finished';
 			if ( parseInt(vote.timestamp) > parseInt(poll.ends)) throw 'Poll has finished';
 			if (vote.poll != poll.id) throw 'Poll id is wrong';
 			if (poll.open && Object.keys(poll.values).indexOf(vote.ballot) == -1 ) throw 'Ballot value is incorrect';
 			if (!poll.open && vote.ballot.substr(0,2) != 'xx' ) throw 'Ballot value is incorrect';
 			var checksum = _hash('sha256', getPrechecksumVote(vote)).substr(0,4);
 			if (checksum != vote.checksum) throw 'Ballot checksum is incorrect';
 			if (!validateCertSig(vote, poll.certkey)) throw 'Ballot is not certified';
 			resolve(true);
 		} catch(e) {
 			console.log(e);
 			resolve(false);
 		}
 	});
 }

 module.exports = {
 	validateVote,
 	validatePoll
 }
