export const helpers = [
    {
      name: "extract_images",
      helper: (input) => {
        if (!input) return "";
  
        let arr = input.split('<').map(item => item.trim());
        let prevWasImage = false;
  
        arr[0] = "";
        arr.pop();
  
        arr = arr.map(item => {
          if (item.startsWith("img") && !prevWasImage) {
            prevWasImage = true;
            return `/section><section class='container images'><${item}`;
          } else if (!item.startsWith("img") && prevWasImage) {
            prevWasImage = false;
            return `/section><section class='small-container'><${item}`;
          } else {
            return item;
          }
        });
  
        return arr.join("<");
      }
    },
    {
      name: "markdown",
      helper: (content) => content
    },
    {
      name: "trim_seo_desc",
      helper: (content) => content ? (content.length <= 140 ? content : content.substring(0, 140)) : undefined
    },
    {
      name: "indexEqualsZero",
      helper: (index) => index === 0
    },
    {
      name: "moreTag",
      helper: (content) => {
        content = content.replace(
          '===more',
          `<a href="#" class="more_link"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 30" fill="none" x="0px" y="0px"><path fill-rule="evenodd" clip-rule="evenodd" d="M5.6159 9.67991C5.79268 9.46777 6.10797 9.4391 6.3201 9.61589L12 14.3491L17.6799 9.61589C17.8921 9.4391 18.2073 9.46777 18.3841 9.67991C18.5609 9.89204 18.5322 10.2073 18.3201 10.3841L12.3201 15.3841C12.1347 15.5386 11.8653 15.5386 11.6799 15.3841L5.67992 10.3841C5.46778 10.2073 5.43912 9.89204 5.6159 9.67991Z" fill="black"/></svg><span>Lees verder ...</span></a><div class="more">`
        );
        content = content.replace('<p></p>', '');
        return content + '</div>';
      }
    },
    {
      name: "relPath",
      helper: (type, language, options) => {
        return language === 'en' ? '../' : './';
      }
    },
    {
      name: "backgroundify",
      helper: (content) => {
        if (!content) return '';
        try {
          if (typeof content !== 'string') {
            content = String(content);
          }
          content = content.replace(/<p>/g, '<p><span>');
          content = content.replace(/<\/p>/g, '</span></p>');
          return content;
        } catch (error) {
          console.error('Error in backgroundify helper:', error);
          return '';
        }
      }
    },
    {
      name: "ifEquals",
      helper: function (a, b, options) {
        if (!options || typeof options.fn !== 'function') return '';
        return a === b ? options.fn() : (typeof options.inverse === 'function' ? options.inverse() : '');
      }
    },
    {
      name: "ifCond",
      helper: (v1, operator, v2, options) => {
        switch (operator) {
          case "==": return (v1 == v2) ? options.fn(this) : options.inverse(this);
          case "===": return (v1 === v2) ? options.fn(this) : options.inverse(this);
          case "!=": return (v1 != v2) ? options.fn(this) : options.inverse(this);
          case "!==": return (v1 !== v2) ? options.fn(this) : options.inverse(this);
          case "<": return (v1 < v2) ? options.fn(this) : options.inverse(this);
          case "<=": return (v1 <= v2) ? options.fn(this) : options.inverse(this);
          case ">": return (v1 > v2) ? options.fn(this) : options.inverse(this);
          case ">=": return (v1 >= v2) ? options.fn(this) : options.inverse(this);
          case "&&": return (v1 && v2) ? options.fn(this) : options.inverse(this);
          case "||": return (v1 !== null || v2 !== null) ? options.fn(this) : options.inverse(this);
          default: return options.inverse(this);
        }
      }
    },
    {
      name: "isUndefined",
      helper: (value, options) => {
        return typeof value === "undefined" ? options.inverse(this) : options.fn(this);
      }
    },
    {
      name: "or",
      helper: (first, second) => first || second
    },
    {
      name: "ifIn",
      helper: (elem, list, options) => list.indexOf(elem) > -1 ? options.fn(this) : options.inverse(this)
    },
    {
      name: "unlessIn",
      helper: (elem, list, options) => list.indexOf(elem) > -1 ? options.inverse(this) : options.fn(this)
    },
    {
      name: "limit",
      helper: (arr, limit) => Array.isArray(arr) ? arr.slice(0, limit) : undefined
    },
    {
      name: "ifMoreThan",
      helper: (a, b, options) => parseInt(a) > b ? options.fn(this) : options.inverse(this)
    },
    {
      name: "stripHTML",
      helper: (content) => {
        return content ? content.toString().replace(/(&nbsp;|<([^>]+)>)/ig, "") : "";
      }
    },
    {
      name: "stripFromHashTags",
      helper: (content) => {
        return content ? content.replace(/^(\s*#\w+\s*)+$/gm, "") : "";
      }
    },
    {
      name: "explode",
      helper: (array) => {
        return array && array.length > 0 ? array.map(obj => obj.slug).join(" ") : "";
      }
    },
    {
      name: "lowercase",
      helper: (words) => {
        return words !== undefined && words !== null && typeof words !== "object" ? words.toLowerCase() : "";
      }
    },
    {
      name: "sluggify",
      helper: (words) => {
        return words !== undefined && words !== null && typeof words !== "object"
          ? words.toLowerCase().replace(/[^a-zA-Z ]/g, "").trim().split(" ").join("-")
          : "fout in naam";
      }
    },
    {
      name: "anchorify",
      helper: (words) => {
        return words !== undefined && words !== null && typeof words !== "object"
          ? words.toString().replace(/(&nbsp;|<([^>]+)>)/ig, "").toLowerCase().replace(/[^a-zA-Z ]/g, "").trim().split(" ").slice(0, 3).join("-")
          : "fout-in-anchor";
      }
    },
    {
      name: "index_of",
      helper: (context, index) => context[index]
    },
    {
      name: "formatDate",
      helper: (date) => {
        try {
          let parsed;
          if (typeof date === 'string') {
            parsed = new Date(date);
            if (isNaN(parsed.getTime())) parsed = new Date(parseInt(date) * 1000);
          } else {
            parsed = new Date(date * 1000);
          }
  
          if (isNaN(parsed.getTime())) {
            console.error('formatDate: Invalid date:', date);
            return '';
          }
  
          return new Intl.DateTimeFormat('nl-NL', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric'
          }).format(parsed);
        } catch (error) {
          console.error('formatDate error:', error);
          return '';
        }
      }
    },
    {
      name: "log",
      helper: (data) => `<script>console.log(${data});</script>`
    },
    {
      name: "json",
      helper: (context) => JSON.stringify(context, null, 2)
    },
    {
      name: "concat",
      helper: (string1, string2) => string1 + string2
    },
    {
      name: "noObject",
      helper: (content) => (content instanceof Object ? '' : content)
    }
  ];
  