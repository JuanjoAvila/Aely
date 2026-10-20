// Browser Storage with real readback for extracted product functions. One store per context.
export function withOwnerStorage(context){
  const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
  context.localStorage=storage;context.window.localStorage=storage;return context;
}
