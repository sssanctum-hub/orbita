// SVG permits adjacent single-character arc flags (e.g. "0022 17").
// AndroidX PathParser expects these flags to be separated from each other and x.
export function androidPath(source) {
  const arity = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
  let index = 0, command = null;
  const result = [];
  const skip = () => { while (index < source.length && /[\s,]/.test(source[index])) index++; };
  while (true) {
    skip();
    if (index === source.length) break;
    if (/[a-z]/i.test(source[index])) command = source[index++];
    if (!command) throw Error('Missing SVG command');
    const upper = command.toUpperCase();
    if (upper === 'Z') { result.push(command); command = null; continue; }
    if (!(upper in arity)) throw Error('Unsupported SVG command: ' + command);
    const values = [];
    for (let parameter = 0; parameter < arity[upper]; parameter++) {
      skip();
      if (upper === 'A' && (parameter === 3 || parameter === 4)) {
        if (source[index] !== '0' && source[index] !== '1') throw Error('Invalid SVG arc flag');
        values.push(source[index++]);
      } else {
        const value = source.slice(index).match(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
        if (!value) throw Error('Missing SVG parameter at ' + index);
        values.push(value[0]);
        index += value[0].length;
      }
    }
    result.push(command + ' ' + values.join(' '));
    if (upper === 'M') command = command === 'M' ? 'L' : 'l';
  }
  return result.join(' ');
}
