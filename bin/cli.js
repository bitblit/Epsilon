#!/usr/bin/env node
const all = require("../dist/index.js");

const RatchetCliHandler = all.RatchetCliHandler;
const handler = new RatchetCliHandler();
handler.findAndExecuteHandler().then(out=>{
  console.log('Normal exit: ',out);
}).catch(err=>{
  console.error('Error : %s', err);
  process.exit(-1);
});
