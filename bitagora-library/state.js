/**
 * BITAGORA LIBRARY
 * state.js
 * Shared functions to interact with Poll state for Bitagora Platform JS modules
 * Developed by Ignasi Ribó, 2018
 * Repo: https://github.com/bitagora/bitagora-core
 * 
 * Based on Hyperledger/Sawtooth
 * https://github.com/hyperledger/sawtooth-core
 * Copyright 2017 Intel Corporation
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
 const { getPollAddress, getVoteAddress, getSettingAddress } = require('./functions');
 const { TpStateGetResponse } = require('sawtooth-sdk/protobuf');
 const cbor = require('cbor');

 class PollState {
   
   constructor (context) {
    this.context = context
    this.timeout = 500
  }
  
  getSetting(string) {
    return new Promise((resolve, reject) => {
     try {
      let address = getSettingAddress(string);
      this.context.getState([address], this.timeout)
      .then((data) => {
       try {
        var getResponse = TpStateGetResponse.decode(data[address]);
        var results = {};
        getResponse.entries.forEach(entry => {
         results[entry.address] = entry.data;
       });
        resolve(Buffer.from(results[string], 'base64').toString());
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
  }

  _encodePollData(ballots, pollAddress, ballot, voteAddress) {
    try {
     var entries;
     let pollData = cbor.encode(ballots);
     if (Boolean(voteAddress) && Boolean(ballot)) {
      let voteData = cbor.encode(ballot);
      entries = {
       [pollAddress]: pollData,
       [voteAddress]: voteData
     }
   } else {
    entries = {
     [pollAddress]: pollData
   }		
 }
 return entries;
} catch(e) {
  return undefined;
}
}

getPoll(pollId) {
  try {
   let pollAddress = getPollAddress(pollId);
   return this._loadPoll(pollAddress).then((state) => {
     if (!Boolean(state)) throw 'No poll in state';
     try {
       let pollInState = JSON.parse(state['poll']);
       return pollInState;
     } catch(e) {
       return undefined;
     }
   }).catch((e) => {
    return undefined;
  });
 } catch(e) {
  return undefined;
}
}

setPoll(poll) {
  try {
    let pollAddress = getPollAddress(poll.id);
    return this._loadPoll(pollAddress).then((state) => {
     if (Boolean(state)) return undefined;
     let k = Object.keys(poll.values);
     let ballots = {};
     for (var i=0; i<k.length; i++) {
       ballots[k[i].toString()] = 0;
     }
     return {'poll': JSON.stringify(poll), 'ballots' : ballots, 'votes': 0 };
   }).then((pollToSet) => {
     if (!Boolean(pollToSet)) return undefined;
     try {
       return this.context.setState(this._encodePollData(pollToSet, pollAddress, null, null), this.timeout);
     } catch(e) {
       return undefined;
     }
   }).catch((e) => {
     return undefined;   		
   });
 } catch(e) {
  return undefined;
}
}

closePoll(poll) {
  try {
    let pollAddress = getPollAddress(poll.id);
    return this._loadPoll(pollAddress).then((state) => {
      try {
        if (!Boolean(state)) return undefined;
        if (!Boolean(poll.privkey)) return undefined;
        let pollData = JSON.parse(state['poll']);
        pollData['privkey'] = poll.privkey;
        return {'poll': JSON.stringify(pollData), 'ballots' : state['ballots'], 'votes': state['votes'] };
      } catch(e) {
       return undefined;				
     }
   }).then((pollToClose) => {
     if (!Boolean(pollToClose)) return undefined;
     try {
       return this.context.setState(this._encodePollData(pollToClose, pollAddress, null, null), this.timeout);
     } catch(e) {
       return undefined;
     }
   }).catch((e) => {
    return undefined;
  });
 } catch(e) {
  return undefined;
}
}

getBallot(poll, vote) {
  try {
    return this._loadBallot(getVoteAddress(poll.id, vote.id));
  } catch(e) {
    return undefined;
  }
}

getBallots(poll) {
  try {
    return this._loadBallot(getVoteAddress(poll.id, vote.id));
  } catch(e) {
    return undefined;
  }
}

setBallot(poll, vote) {
  try {
    let voteAddress = getVoteAddress(poll.id, vote.id);
    let pollAddress = getPollAddress(poll.id);
    return this._loadPoll(pollAddress).then((state) => {
     try {
       if (!Boolean(state) || !Boolean(state['poll'] || Boolean(state['privkey']))) throw 'No data';
       if (poll.open) {
        let option = vote.ballot;
        if (!Boolean(state['ballots'][option]) && state['ballots'][option] != 0) throw 'No data'; 
        state['ballots'][option] = state['ballots'][option] + 1;
      } 
      state['votes'] = state['votes'] + 1;
      return state;
    } catch(e) {
     return undefined;
   }
 }).then((ballotsToSet) => {
   try {
     if (!Boolean(ballotsToSet)) throw 'No ballot to set';
     return this.context.setState(this._encodePollData(ballotsToSet, pollAddress, vote.ballot, voteAddress), this.timeout);
   } catch(e) {
     return undefined;
   }
 }).catch((e) => {
  return undefined;
});
} catch(e) {
  return undefined;
} 
}

_loadPoll(pollAddress) {
  return this.context.getState([pollAddress], this.timeout).then((data) => {
    try {
     if (!Boolean(data) || !Boolean(data[pollAddress]) || data[pollAddress].length == 0) throw 'No data';
     return cbor.decode(data[pollAddress], 'base64');
   } catch(e) {
     return undefined;
   }
 });
}

_loadBallot(ballotAddress) {
  return this.context.getState([ballotAddress], this.timeout).then((data) => {
    try {
     if (!Boolean(data) || !Boolean(data[ballotAddress]) || data[ballotAddress].length == 0) throw 'No data';
     return cbor.decode(data[ballotAddress], 'base64');
   } catch(e) {
     return undefined;
   }
 });
}
}

module.exports = {
	PollState
}