/**
 * BITAGORA CERTIFIER
 * index.js
 * Handlers for AWS lambda Certifier instance. Work in progress. 
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
const crypto = require('crypto');
const {createPoll, closePoll, registerVoter } = require('./certifier.js');
var AWS = require("aws-sdk");
var awsConfig = new AWS.Config();

/// CERTIFIER SETTINGS
/// These settings need to be adjusted for each Certifier instance
const S3bucket = 'bitagora-polls'; // AWS S3 bucket name
awsConfig.update({ region: 'eu-central-1' }); // AWS region
const certifierId = 'abd88b149c12ed6f'; // Certifier id 8 bytes hex string
const certifierKey = '6dc7e4849eb951e2f5df3949c129940855ee1dc5e8133a1d34e0d767cd4f7c25';  // Certifier key 32 bytes hex string
const validator = 'validator-es.js'; // name of the validator file in the /validators directory

// The initial_context object is partially set with the information of the poll that the certifier will be
// employed for. The values of privkey, secret, id, certkey and approval are left as null. They are
// only set by the Certifier instance at runtime.
const initial_context = {
	"privkey":null,  	// Leave null - Needs to be set by certifier instance
    "secret":null,  // Leave null - Needs to be set by certifier instance
    "poll":
	{
		"id":null,   // Leave null - Needs to be set by certifier instance
		"certkey":null,  // Leave null - Needs to be set by certifier instance
		"starts":"1535734800000",  // JS time value
		"ends":"1543597200000",  // JS time value
		"question":"Some question?",  // String
		"values":{"00":"Option 1","01":"Option 2"},  // JSON object with values and options
		"open": true,  // Boolean true/false
		"adminkey":"025cc23ab1d64668e54acbfcf911806666a553968ee3322ca1829037e40b46c0e9", // Hex string. Administrator public key
		"approval":null   // Leave null - Needs to be set by certifier instance
	}
}
///// End of settings


function encrypt(data) {
	const cipher = crypto.createCipher('aes192', certifierKey);
	var encrypted = cipher.update(data, 'utf8', 'hex');
	encrypted += cipher.final('hex');
	return encrypted;
}

function decrypt(ciphertext) {	
	const decipher = crypto.createDecipher('aes192', certifierKey);
	var decrypted = decipher.update(ciphertext, 'hex', 'utf8');
	decrypted += decipher.final('utf8');
	return decrypted;
}

function putObjectToS3(key, data){
	return new Promise((resolve, reject) => {
		try {
   			var s3 = new AWS.S3();
			var params = {
    				Bucket: S3bucket,
    				Key: key,
    				Body: encrypt(JSON.stringify(data))
			};
		    s3.putObject(params, function(err, respo) {
    	   			if (err) {
					reject(err); 
				} else {
       				resolve(respo); 
				}
    			});	
		} catch(e) {
			reject(e);	
		}
	});
}

function getObjectFromS3(key) {
	return new Promise((resolve, reject) => {
		try {
   			var s3 = new AWS.S3();
    			var params = {
        			Bucket : S3bucket,
         		Key : key
       		}
		    s3.getObject(params, function(err, respo) {
    	   			if (err){
					reject(err); 
				} else {
					let encrypted = Buffer.from(respo['Body']).toString();
					let decrypted = decrypt(encrypted);
					resolve(JSON.parse(decrypted));
				}
    			});	
		} catch(e) {
			reject(e);	
		}
	});
}

exports.handler = (event, context, callback) => {

	const done = (err, res) => callback(null, {
        statusCode: err ? '400' : '200',
        body: err ? err : JSON.stringify(res),
        headers: { 'Content-Type': 'application/json' },
    });
	
	function createNewPoll(privkey) {
		createPoll(privkey, initial_context).then((result) => {
			if (Boolean(result) && result.status == 'COMMITTED') {
				putObjectToS3(certifierId, result.context).then((stored) => {
					if (stored) {
						done(null, result.response);
					} else {
						done('Poll has been created, but could not be stored in S3 bucket.');
					}
				}).catch((e) => {
					done('Poll has been created, but could not be stored in S3 bucket.');						
				});
			} else {
				done(result.response);
			}
		}).catch((e) => {
			done('Failed to create poll');
		});	
	}
	let data = event.body;
	//let data = JSON.parse(event.body);
    switch (event.httpMethod) {
        case 'GET':
			getObjectFromS3(certifierId).then((context) => {
				try {
					if (Boolean(context.poll)) {
						registerVoter(data.poll, data.id, context, validator).then((result) => {
							if (result) {
								done(null, result);
							} else {
								done('Invalid request');
							}
		   				}).catch((e) => {
			  				done(e);
		    				});
					} else {
						done('Internal error');
					}
				} catch(e) {
					done('Internal error');				
				}
			}).catch((e) => {
				done('Internal error');
			});
            break;
        case 'POST':
			if (data.action == 'create') {
				getObjectFromS3(certifierId).then((context) => {
					if (Boolean(context.poll) && Boolean(context.privkey)) {
						done('Poll already exists. Nothing done.');
					} else {
						createNewPoll(data.privkey);	
					}
				}).catch((e) => {
					if (e.code == 'NoSuchKey') {
						createNewPoll(data.privkey);
					} else {
						done('Failed to create poll. Invalid request to S3.');
					}
				});					
			} else if (data.action == 'close' ) {
				getObjectFromS3(certifierId).then((context) => {
					try {
						if (Boolean(context) && Boolean(context['poll'])) {
							closePoll(data.privkey, context).then((result) => {
								if (Boolean(result) && result.status == 'COMMITTED') {
									putObjectToS3(certifierId, result.context).then((stored) => {
										if (stored) {
											done(null, result.response);
										} else {
											done('Poll has been closed, but context could not be stored.');
										}
									}).catch((e) => {
										done('Poll has been closed, but context could not be stored.');						
									});
								} else {
									done(result.response);
								}
							}).catch((e) => {
								done('Failed to close poll. Error while closing.');
							});				
						} else {
							done('Failed to close poll. No context retrieved from S3.');
						}
					} catch(e) {
						done('Failed to close poll. Error while retrieving context.');
					}
				}).catch((e) => {
					done('Failed to close poll. Invalid request to S3.');
				});
			} else {
				done(new Error('Unsupported action'));
			}
            break;
        default:
           done(new Error(`Unsupported method "${event.httpMethod}"`));
    }
};
