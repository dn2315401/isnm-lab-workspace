export function writeResearchStorage(key:string,value:string){localStorage.setItem(key,value);if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('isnm-research-records-changed'))}
