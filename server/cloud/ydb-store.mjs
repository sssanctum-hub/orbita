// DynamoDB-compatible YDB Document API. Never log tokens or request bodies.
export function ydbStore(endpoint, token, table = 'orbita') {
 if (!endpoint?.startsWith('https://docapi.serverless.yandexcloud.net/')) throw Error('Invalid YDB endpoint');
 async function call(method, input, retry = true) {
  const response = await fetch(endpoint, {method:'POST', headers:{Authorization:'Bearer '+token,'Content-Type':'application/x-amz-json-1.0','X-Amz-Target':'DynamoDB_20120810.'+method},body:JSON.stringify(input),signal:AbortSignal.timeout(10000)});
  const result = await response.json();
  if (!response.ok && retry && result.__type?.includes('ResourceNotFound')) {
   try { await call('CreateTable',{TableName:table,AttributeDefinitions:[{AttributeName:'id',AttributeType:'S'}],KeySchema:[{AttributeName:'id',KeyType:'HASH'}]},false); }
   catch(error) { if (!error.code?.includes('ResourceInUse')) throw error; }
   await call('UpdateTimeToLive',{TableName:table,TimeToLiveSpecification:{AttributeName:'expiresAt',Enabled:true}},false);
   return call(method,input,false);
  }
  if (!response.ok) { const error=Error('YDB request failed');error.code=result.__type;throw error; }
  return result;
 }
 function condition(expected) {
  return expected === null ? {ConditionExpression:'attribute_not_exists(id)'} : expected === undefined ? {} : {ConditionExpression:'#v = :expected',ExpressionAttributeNames:{'#v':'version'},ExpressionAttributeValues:{':expected':{N:String(expected)}}};
 }
 function item(id,value) {return {id:{S:id},value:{S:JSON.stringify(value)},version:{N:String(value.version||0)},...(value.expires?{expiresAt:{N:String(Math.ceil(value.expires/1000))}}:{})};}
 const conflict=error=>/ConditionalCheckFailed|TransactionCanceled/.test(error.code||'');
 return {
  async get(id){const r=await call('GetItem',{TableName:table,Key:{id:{S:id}},ConsistentRead:true});return r.Item?JSON.parse(r.Item.value.S):null;},
  async put(id,value,expected){try{await call('PutItem',{TableName:table,Item:item(id,value),...condition(expected)});return true;}catch(e){if(conflict(e))return false;throw e;}},
  async remove(id){await call('DeleteItem',{TableName:table,Key:{id:{S:id}}});},
  async transact(operations){
   const TransactItems=operations.map(op=>op.type==='check'?{ConditionCheck:{TableName:table,Key:{id:{S:op.key}},...condition(op.expected)}}:op.type==='delete'?{Delete:{TableName:table,Key:{id:{S:op.key}},...condition(op.expected)}}:{Put:{TableName:table,Item:item(op.key,op.value),...condition(op.expected)}});
   try{await call('TransactWriteItems',{TransactItems});return true;}catch(e){if(conflict(e))return false;throw e;}
  },
  async enableTTL(){await call('UpdateTimeToLive',{TableName:table,TimeToLiveSpecification:{AttributeName:'expiresAt',Enabled:true}});},
 };
}
