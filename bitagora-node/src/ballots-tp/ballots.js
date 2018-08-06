/**
 * BITAGORA NODE
 * ballots.js
 * Entrypoint for Ballot Transaction Processor in Bitagora Platform voting system
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
 const { TransactionProcessor } = require('sawtooth-sdk/processor');
 const { BallotsHandler } = require('./ballots-handler');
 if (process.argv.length < 3) {
 	console.log('Missing a validator address');
 	process.exit(1);
 }
 const ValidatorAddress = process.argv[2];
 const transactionProcessor = new TransactionProcessor(ValidatorAddress);
 transactionProcessor.addHandler(new BallotsHandler());
 transactionProcessor.start();



