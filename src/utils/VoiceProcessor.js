/**
 * Simple NLP Processor for Expense Voice Commands (Hinglish/English support)
 */

const HINDI_NUMS = {
  'ek': 1, 'do': 2, 'teen': 3, 'chaar': 4, 'paanch': 5,
  'chey': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'dus': 10,
  'bees': 20, 'tees': 30, 'chaalis': 40, 'pachaas': 50,
  'sau': 100, 'hazaar': 1000, 'haala': 1000, 'lakh': 100000
};

export function parseExpenseVoice(transcript, knownMembers = []) {
  const text = transcript.toLowerCase();
  const result = {
    amount: null,
    description: '',
    payer: 'Me',
    participants: [],
    shouldSubmit: false
  };

  // 0. Check for Execution Keywords (Save/Confirm)
  const submitKeywords = ['save', 'confirm', 'done', 'submit', 'theek hai', 'ho gaya', 'bhejo', 'save karlo'];
  if (submitKeywords.some(k => text.includes(k))) {
    result.shouldSubmit = true;
  }

  // 1. Extract Amount
  // Look for direct digits
  const digitMatch = text.match(/(\d+)/);
  if (digitMatch) {
    result.amount = parseFloat(digitMatch[1]);
  } else {
    // Look for Hindi word numbers (simple version)
    for (const [word, val] of Object.entries(HINDI_NUMS)) {
      if (text.includes(word)) {
        if (word === 'sau' || word === 'hazaar') {
            // Check if there was a number before it (e.g. "paanch sau")
            // This is complex for a simple regex, but let's try a basic approach
            const parts = text.split(' ');
            const idx = parts.indexOf(word);
            if (idx > 0 && HINDI_NUMS[parts[idx-1]]) {
                result.amount = HINDI_NUMS[parts[idx-1]] * val;
            } else {
                result.amount = val;
            }
        } else {
            result.amount = val;
        }
        break; 
      }
    }
  }

  // 2. Extract Payer
  // "I paid", "Rahul paid", "Paid by Priya"
  const payerMatch = text.match(/([a-z]+)\s+paid/);
  if (payerMatch && payerMatch[1] !== 'i') {
    const found = knownMembers.find(m => m.toLowerCase() === payerMatch[1]);
    if (found) result.payer = found;
  }

  // 3. Extract Participants
  // "with Arjun and Rahul", "saath Rahul ke", "and Amit"
  const splitText = text.split(/\b(with|saath|and|aur)\b/);
  if (splitText.length > 1) {
    const pPart = splitText.slice(1).join(' ');
    knownMembers.forEach(m => {
      if (pPart.includes(m.toLowerCase())) {
        result.participants.push(m);
      }
    });
  }

  // 4. Extract Description
  // Mostly what remains after stripping amount and participants
  let desc = text
    .replace(/\b\d+\b/g, '') // remove digits
    .replace(/\b(paid|for|rupaye|rupees|amount)\b/g, '')
    .replace(/\b(with|saath|and|aur)\b.*/, '') // remove everything after participants start
    .trim();
    
  // Strip payer names if they were detected as payer
  if (result.payer !== 'Me') {
    desc = desc.replace(result.payer.toLowerCase(), '').trim();
  }
  
  result.description = desc.charAt(0).toUpperCase() + desc.slice(1);

  return result;
}
