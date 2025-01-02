export default function extractNumber(str) {
  const number = str.replace(/\D/g, '');
  return parseInt(number, 10);
}
