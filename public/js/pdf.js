// Placeholder for PDF.js
var pdfjsLib = { getDocument: () => ({ promise: Promise.resolve({ numPages:1, getPage: async()=>({getTextContent: async()=>({items:[{str:'Exemplo PDF'}]})}) }) }) };