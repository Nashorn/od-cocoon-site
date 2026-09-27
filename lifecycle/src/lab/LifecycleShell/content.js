// Every editable stage label and message lives in this file.
export const PHASES = [
  { label:'Application Boot', name:'APPLICATION BOOT', method:'DOMContentLoaded', owner:'Browser', state:'booting', status:'boot activity · document', tasks:['Wait for DOM','Read configuration','Prepare import map'], event:['DOMContentLoaded','Framework initialized and discovery begins.'] },
  { label:'Discovery', name:'DISCOVER', method:'ComponentLoader.scan()', owner:'Cocoon', state:'resolving', status:'component import · hello-world', tasks:['Discover undefined tags','Resolve tags','Imports related tag modules'], event:['Resolving tags','.importmap → auto import related modules'] },
  { label:'Define', name:'DEFINE', method:'customElements.define()', owner:'Browser', state:'defined', status:'custom element · registered', tasks:['Derive tag name','Record ancestry','Upgrade matching tags'], event:['Custom element registered','customElements.define()'] },
  { label:'Constructor Runs', name:'CONSTRUCT', method:'initialize()', owner:'Cocoon', state:'constructed', status:'component · root created', tasks:['Create instance','Choose DOM root','Prepare initial slot'], event:['Component root created','initialize()'] },
  { label:'onConnected Fires', name:'CONNECT', method:'onConnected() callback runs', owner:'Browser', state:'connecting', status:'component activity · started', tasks:['Check if lazy loaded or not','Load component .html template','Load stylesheets'], event:['Entered the document','connectedCallback()'] },
  { label:'Parse Stylesheets', name:'STYLE', method:'Internal loadStylesheets() fires', owner:'Cocoon', state:'styling', status:'stylesheet activity · component', tasks:['Parse and build stylesheet tree','Adopt document stylesheets','Adopt local stylesheets'], event:['Stylesheets adopted','loadStylesheets()'] },
  { label:'Parse DOM', name:'PARSE DOM', method:'Internal engine.parse() fires', owner:'Cocoon', state:'parsing', status:'template activity · hydrated fragment', tasks:['Resolve template','Parse hydrated HTML','Insert DOM fragment'], event:['Hydrated HTML parsed','engine.parse() → fragment'] },
  { label:'Rendered', name:'RENDERED', method:'onRendered() fires · an available hook', owner:'Cocoon', state:'rendered', status:'render activity · component', tasks:['onConnected completes','Template applied; Styles applied','onRendered() signals completion'], event:['Component rendered','onRendered()'] },
  { label:'World Ready', name:'WORLD', method:'page:rendered', owner:'Cocoon', state:'alive', status:'page settled · world ready', tasks:['Activate component','Wait for quiet','Announce page ready'], event:['Connected to the world','page:rendered'] }
];

export const STORIES = {
  birth: { step:'01 / COMPONENT BIRTH', title:'From markup.<br>Into the world.', copy:'Follow one component through discovery, definition, styling, rendering, and connection.', instruction:'Step through the runtime.<br>See what Cocoon handles for you.' },
  lazy: { step:'02 / LAZY ARRIVAL', title:'Connected.<br>Right on time.', copy:'A lazy component enters the document immediately, then waits at the connection gate until it reaches the viewport.', instruction:'Watch the lifecycle pause.<br>Then let the component arrive.' },
  reconnect: { step:'03 / DISCONNECT & RECONNECT', title:'Sleep.<br>Then wake again.', copy:'Removing the element invokes cleanup and sleep. Returning it to the DOM begins the connection pipeline again.', instruction:'Detach the live component.<br>Watch it reconnect cleanly.' }
};
