// escape all markdown

module.exports = (text) => {
  return text.replace(/(\*|_|~|`|#|@|\[|\]|\(|\)|>|:|;|\{|\}|\||\^|!|\?|\+|\/|\||&|\$)/g, "\\$1");
};