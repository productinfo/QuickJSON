var JSONFormatter = (function() {
  var toString    = Object.prototype.toString
    , whitespace  = '[\s\u200B\uFEFF]*'
    , is_jsonp_re = new RegExp // This regex attempts to match a JSONP structure
      ( '^' + whitespace // optional leading ws
      + '([\\w$\\[\\]\\.]+)' // callback name (function name; ECMA-262, 3rd ed.)
      + whitespace +'\\('+ whitespace // open parenthesis, with optional ws
      + '('
       + '[\\[{]' // { or [, the only two valid characters to open JSON strings
       + '[\\s\\S]*' // any character, any number of times (including newlines)
       + '[\\]}]' // } or ], the only two valid close characters of JSON strings
      + ')'
      + whitespace +'\\)'+ whitespace // closing parenthesis, with optional ws
      + '([\s\u200B\uFEFF;]*)$' // optional trailing ws and semicolon
      );
    // (this of course misses anything that has comments, more than one callback
    // -- or otherwise requires modification before use by a proper JSON parser)

  function detectJSONP(s, url) {
    var js = s, cb = '', se = '', match;
    if ((match = is_jsonp_re.exec(s)) && 4 === match.length) {
      cb = match[1];
      js = match[2];
      se = match[3].replace(/[^;]+/g, '');
    }

    try {
      return wrapJSONP(JSON.parse(js), cb, se, url);
    }
    catch (e) {
      return error(e, s, se, url);
    }
  }

  // Convert a JSON value / JSONP response into a formatted HTML document
  function wrapJSONP(val, callback, semicolon, url) {
    var output = '<span id="json">' +
        value(val, callback ? '' : null, callback && '<br\n/>') +
      '</span>';
    if (callback)
      output = '<span class="callback">'+ callback +'(</span>'+ output +
               '<span class="callback">)'+ semicolon +'</span>';
    return doc(output, url);
  }

  // utility functions

  function isArray(obj) {
    return '[object Array]' === toString.call(obj);
  }

  // Wrap a fragment in a span of class className
  function span(value, className) {
    return '<span class="'+ className +'">'+ html(value) +'</span>';
  }

  // Wrap a fragment of HTML in a document
  function doc(fragment, title) {
    return '<!DOCTYPE html>\n' +
      '<html><head><title>'+ html(title) +'</title>\n' +
      '<link rel="stylesheet" type="text/css" href="json.css">\n' +
      '<script type="text/javascript" src="live.js"></script>\n' +
      '</head><body>\n'+ fragment +'<br\n/></body></html>';
  }

  // Produce an error document for when parsing fails
  function error(e, data, url) {
    var output = '<div id="error">Error parsing JSON: '+ e +'</div>';
    output += '<h1>Document contents:</h1>';
    output += '<span id="json">'+ html(data) +'</span>';
    return doc(output, (url ? url +' - ' : '') +'Error');
  }

  // escaping functions

  function html(s, isAttribute) {
    if (s == null) return '';
    s = (s+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return isAttribute ? s.replace(/"/g, '&quot;') : s;
  }

  var js = JSON.stringify('\b\f\n\r\t') === '"\\b\\f\\n\\r\\t"' ?
    function saneJSEscaper(s, noQuotes) {
      s = html(JSON.stringify(s).slice(1, -1));
      return noQuotes ? s : '"'+ s +'"';
    }
  : function insaneEscaper(s, noQuotes) {
    // undo all damage of an \uXXXX-tastic Mozilla JSON serializer
    var had = { '\b': 'b' // return
              , '\f': 'f' // these
              , '\r': 'r' // to the
              , '\n': 'n' // tidy
              , '\t': 't' // form
              }, ws;      // below
    for (ws in had)
      if (-1 === s.indexOf(ws))
        delete had[ws];

    s = JSON.stringify(s).slice(1, -1);

    for (ws in had)
      s = s.replace(new RegExp('\\\\u000'+(ws.charCodeAt().toString(16)), 'ig'),
                    '\\'+ had[ws]);

    s = html(s);
    return noQuotes ? s : '"'+ s +'"';
  };

  // conversion functions

  // Convert JSON value (Boolean, Number, String, Array, Object, null)
  // into an HTML fragment
  function value(v, indent, nl) {
    var output;
    switch (typeof v) {
      case 'boolean':
        output = span(v, 'bool');
      break;

      case 'number':
        output = span(v, 'num');
      break;

      case 'string':
        if (/^(\w+):\/\/[^\s]+$/i.test(v)) {
          output = '"<a href="'+ html(v, !!'attribute') +'">' +
                     js(v, '!"') +
                   '</a>"';
        } else {
          output = '<span class="string">'+ js(v) +'</span>';
        }
      break;

      case 'object':
        if (null === v) {
          output = span('null', 'null');
        } else {
          indent = indent == null ? '' : indent +'&nbsp; ';
          if (isArray(v)) {
            output = array(v, indent, nl);
          } else {
            output = object(v, indent, nl);
          }
        }
      break;
    }
    return output;
  }

  // Convert an Object to an HTML fragment
  function object(obj, indent, nl) {
    var output = '';
    for (var key in obj) {
      if (output) output += '<br\n/>'+ indent +', ';
      output += '<span class="prop">'+ js(key) +'</span>: ' +
        value(obj[key], indent, '<br\n/>');
    }
    if (!output) return '{}';
    return '<span class="unfolded obj"><span class="content">' +
             (nl ? nl + indent : '') +'{ '+ output +'<br\n/>' +
                              indent +'}</span></span>';
  }

  // Convert an Array into an HTML fragment
  function array(a, indent, nl) {
    for (var i = 0, output = ''; i < a.length; i++) {
      if (output) output += '<br\n/>'+ indent +', ';
      output += value(a[i], indent, '');
    }
    if (!output) return '[]';
    return '<span class="unfolded array"><span class="content">' +
             (nl ? nl + indent : '') +'[ '+ output +'<br\n/>' +
                              indent +']</span></span>';
  }

  return function JSONFormatter(s, url) {
    return detectJSONP(s, url);
  };
})();
