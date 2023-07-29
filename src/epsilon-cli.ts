#!/usr/bin/env node

import {RatchetCliHandler} from "./cli/ratchet-cli-handler";

const handler:RatchetCliHandler = new RatchetCliHandler();
handler.findAndExecuteHandler().then(out=>{
  console.log('Normal exit: ',out);
}).catch(err=>{
  console.error('Error : %s', err);
  process.exit(-1);
});
