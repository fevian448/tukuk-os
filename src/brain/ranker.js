const config = require('../config');

// Simple PageRank-like scoring based on link popularity
const scores = new Map();
const DAMPING = 0.85;
const ITERATIONS = 3;

function computePageRank(documents) {
  const urls = documents.map(d => d.url);
  const outgoing = new Map();
  const incoming = new Map();

  // Initialize
  for (const url of urls) {
    outgoing.set(url, []);
    incoming.set(url, []);
    scores.set(url, 1 / urls.length);
  }

  // Build link graph
  for (const doc of documents) {
    const from = doc.url;
    for (const link of (doc.links || [])) {
      if (urls.includes(link)) {
        outgoing.get(from).push(link);
        incoming.get(link).push(from);
      }
    }
  }

  // Iterate PageRank
  for (let i = 0; i < ITERATIONS; i++) {
    const newScores = new Map();
    for (const url of urls) {
      let rank = (1 - DAMPING) / urls.length;
      for (const inLink of incoming.get(url)) {
        rank += DAMPING * scores.get(inLink) / outgoing.get(inLink).length;
      }
      newScores.set(url, rank);
    }
    for (const [url, score] of newScores) {
      scores.set(url, score);
    }
  }
}

function getPageRank(url) {
  return scores.get(url) || 0;
}

function enrichDocuments(documents) {
  computePageRank(documents);
  return documents.map(doc => ({
    ...doc,
    pageRank: getPageRank(doc.url)
  }));
}

module.exports = { computePageRank, getPageRank, enrichDocuments };
