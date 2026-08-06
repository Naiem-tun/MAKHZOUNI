const parseNumber = (val) => {
  let str = val.replace(/\s/g, '');
  if (str.includes(',') && !str.includes('.')) {
    str = str.replace(',', '.');
  } else if (str.includes(',') && str.includes('.')) {
    str = str.replace(/,/g, '');
  }
  return parseFloat(str) || 0;
};
console.log(parseNumber("1677,26"));
console.log(parseNumber("1 677,26"));
console.log(parseNumber("1,677.26"));
console.log(parseNumber("1677.26"));
