/* bitGen Studio — ext/lifedock/lifepuzzles.js (2.944.0): 🎓 LIFE CHOICES - the puzzles (window.H3LifePuzzles; pure, no DOM).
 *
 * Tim: "make the quizes at least grade 12 level if they drop out it is ok ... same with college level. i am assuming the
 * majority of people using bitgen would be at least at my level or better".
 *   MATHS   generated in code from a seed - always right: high school (grade 12: quadratics, derivatives, logs and
 *           exponents, series, simultaneous equations, probability, compound interest), college (integrals,
 *           determinants, eigenvalues, limits, modular arithmetic, binomial probability, sums of squares), trade (area,
 *           concrete, Ohm's law, power, rafters, mixes, paint) and work (a mix)
 *   WORDS   from OUR OWN word lists: unscramble a word, fill in the missing letters, the closest meaning (synonyms we
 *           wrote ourselves) - the anagram words were picked to have no common second arrangement
 *   QUIZ    a question bank we wrote ourselves (science, maths, history, geography, literature, economics; high school
 *           and university level) - no imported trivia sets
 * make(level, topic, rnd) -> {level, topic, kind: "choice"|"number"|"fraction"|"word", q, choices?, answer, hint?, secs}
 * check(puzzle, given) -> bool;  levels: hs | college | trade | work;  topics: math | word | quiz | any
 */
(function (root) {
  "use strict";
  var ri = function (R, a, b) { return a + Math.floor(R() * (b - a + 1)); };
  var pick = function (R, a) { return a[Math.floor(R() * a.length)]; };
  function shuffle(R, a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a || 1; }
  function frac(n, d) { var g = gcd(n, d); n /= g; d /= g; if (d < 0) { n = -n; d = -d; } return d === 1 ? String(n) : n + "/" + d; }
  function nCr(n, r) { var x = 1; for (var i = 1; i <= r; i++) x = x * (n - r + i) / i; return Math.round(x); }
  var sgn = function (v, first) { return v === 0 ? "" : (v < 0 ? (first ? "-" : " - ") : (first ? "" : " + ")) + Math.abs(v); };
  /** a polynomial as text: [[coef, power], ...] -> "2x³ - 3x + 4" */
  function poly(terms) {
    var SUP = { 2: "²", 3: "³", 4: "⁴" }, s = "";
    terms.forEach(function (t) {
      var c = t[0], p = t[1]; if (!c) return;
      var first = !s, mag = Math.abs(c), body = p === 0 ? String(mag) : (mag === 1 ? "" : mag) + "x" + (p > 1 ? SUP[p] || "^" + p : "");
      s += (c < 0 ? (first ? "-" : " - ") : (first ? "" : " + ")) + body;
    });
    return s || "0";
  }

  /* ---------------- maths ---------------- */
  var MATH = {
    hs: [
      function (R) { var a = ri(R, -9, 9), b = ri(R, -9, 9); while (b === a) b = ri(R, -9, 9);
        return { q: "Solve " + poly([[1, 2], [-(a + b), 1], [a * b, 0]]) + " = 0. Give the LARGER root.", kind: "number", answer: Math.max(a, b) }; },
      function (R) { var a = ri(R, 1, 4) * (R() < 0.5 ? -1 : 1), b = ri(R, -6, 6), c = ri(R, -9, 9), d = ri(R, -9, 9), k = ri(R, -3, 3);
        return { q: "f(x) = " + poly([[a, 3], [b, 2], [c, 1], [d, 0]]) + ". What is f′(" + k + ")?", kind: "number", answer: 3 * a * k * k + 2 * b * k + c }; },
      function (R) { var b = pick(R, [2, 3, 5]), n = ri(R, 2, b === 2 ? 9 : 5), k = ri(R, 1, 3);
        return { q: "Solve for x:  " + b + "^(x + " + k + ") = " + Math.pow(b, n), kind: "number", answer: n - k }; },
      function (R) { var a = ri(R, -5, 12), d = ri(R, 2, 9), n = ri(R, 8, 25);
        return { q: "An arithmetic sequence starts at " + a + " and goes up by " + d + " each term. What is the sum of the first " + n + " terms?", kind: "number", answer: n * (2 * a + (n - 1) * d) / 2 }; },
      function (R) { var x = ri(R, -7, 9), y = ri(R, -7, 9), a = ri(R, 2, 5), b = ri(R, -4, 4) || 3, c = ri(R, 1, 4), d = ri(R, -5, 5) || -2;
        while (a * d - b * c === 0) d++;
        return { q: "Solve the pair:  " + poly([[a, 1]]) + sgn(b) + "y = " + (a * x + b * y) + "   and   " + poly([[c, 1]]) + sgn(d) + "y = " + (c * x + d * y) + ".  What is x?", kind: "number", answer: x }; },
      function (R) { var s = ri(R, 2, 12), n = 6 - Math.abs(7 - s);
        return { q: "Two fair six-sided dice are rolled. What is the probability that the total is " + s + "? (a fraction, like 1/6)", kind: "fraction", answer: frac(n, 36) }; },
      function (R) { var p = pick(R, [1000, 2000, 5000, 10000, 20000]), r = pick(R, [5, 10, 20]), y = 2;
        return { q: "$" + p.toLocaleString("en-AU") + " is invested at " + r + "% a year, compounded yearly. How many dollars is it worth after " + y + " years?", kind: "number", answer: Math.round(p * Math.pow(1 + r / 100, y)) }; },
      function (R) { var a = ri(R, 1, 5), r = pick(R, [2, 3]), n = ri(R, 4, r === 2 ? 9 : 6);
        return { q: "A geometric series starts at " + a + " and each term is " + r + " times the last. What is the sum of the first " + n + " terms?", kind: "number", answer: a * (Math.pow(r, n) - 1) / (r - 1) }; },
      function (R) { var n = ri(R, 6, 12), r = ri(R, 2, 4);
        return { q: "In how many ways can a committee of " + r + " be chosen from " + n + " people?", kind: "number", answer: nCr(n, r) }; },
      function (R) { var a = ri(R, 2, 6), b = ri(R, -9, 9), k = ri(R, 1, 4);
        return { q: "Evaluate the integral of (" + poly([[2 * a, 1], [b, 0]]) + ") dx from 0 to " + k + ".", kind: "number", answer: a * k * k + b * k }; },
    ],
    college: [
      function (R) { var a = 3 * ri(R, 1, 3) * (R() < 0.3 ? -1 : 1), b = 2 * ri(R, -4, 4), k = ri(R, 1, 4);
        return { q: "Evaluate ∫₀^" + k + " (" + poly([[a, 2], [b, 1]]) + ") dx.", kind: "number", answer: a * k * k * k / 3 + b * k * k / 2 }; },
      function (R) { var m = [0, 1, 2].map(function () { return [ri(R, -4, 5), ri(R, -4, 5), ri(R, -4, 5)]; });
        var det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
        return { q: "What is the determinant of the matrix  [" + m.map(function (r) { return r.join(", "); }).join(" ; ") + "]?", kind: "number", answer: det }; },
      function (R) { var l1 = ri(R, -4, 7), l2 = ri(R, -4, 7); while (l2 === l1) l2 = ri(R, -4, 7);
        var a = ri(R, -3, 6), d = l1 + l2 - a, bc = a * d - l1 * l2, b = pick(R, [1, -1, 2, -2].filter(function (x) { return bc % x === 0; })), c = bc / b;
        return { q: "What is the LARGER eigenvalue of the matrix  [" + a + ", " + b + " ; " + c + ", " + d + "]?", kind: "number", answer: Math.max(l1, l2) }; },
      function (R) { var a = ri(R, 2, 6), cube = R() < 0.5;
        return { q: "Find the limit as x → " + a + " of  (x" + (cube ? "³" : "²") + " - " + Math.pow(a, cube ? 3 : 2) + ") / (x - " + a + ").", kind: "number", answer: cube ? 3 * a * a : 2 * a }; },
      function (R) { var b = ri(R, 2, 9), e = ri(R, 10, 60), m = pick(R, [7, 11, 13, 17]), v = 1; for (var i = 0; i < e; i++) v = (v * b) % m;
        return { q: "What is " + b + "^" + e + " mod " + m + "?", kind: "number", answer: v }; },
      function (R) { var n = ri(R, 4, 8), k = ri(R, 1, n - 1);
        return { q: "A fair coin is tossed " + n + " times. What is the probability of exactly " + k + " heads? (a fraction)", kind: "fraction", answer: frac(nCr(n, k), Math.pow(2, n)) }; },
      function (R) { var n = ri(R, 8, 30);
        return { q: "What is 1² + 2² + 3² + … + " + n + "²?", kind: "number", answer: n * (n + 1) * (2 * n + 1) / 6 }; },
      function (R) { var a = ri(R, 2, 4), b = ri(R, -3, 3), n = ri(R, 2, 4), k = ri(R, 0, 2);
        return { q: "If f(x) = (" + poly([[a, 1], [b, 0]]) + ")^" + n + ", what is f′(" + k + ")?", kind: "number", answer: n * a * Math.pow(a * k + b, n - 1) }; },
      function (R) { var n = 2 * ri(R, 2, 10);
        return { q: "A fair six-sided die is rolled " + n + " times. What is the expected total?", kind: "number", answer: 3.5 * n }; },
      function (R) { var a = ri(R, 2, 5), r = ri(R, 2, 4);
        return { q: "Find the sum of the infinite geometric series  " + a * r + " + " + a + " + " + frac(a, r) + " + …  (a fraction if needed)", kind: "fraction", answer: frac(a * r * r, r - 1) }; },
    ],
    trade: [
      function (R) { var l = ri(R, 25, 60) / 10, w = ri(R, 20, 45) / 10;
        return { q: "A room is " + l + " m by " + w + " m. What is its floor area in m²?", kind: "number", answer: Math.round(l * w * 100) / 100, tol: 0.01 }; },
      function (R) { var l = ri(R, 4, 12), w = ri(R, 3, 8), d = pick(R, [100, 125, 150]);
        return { q: "A concrete slab is " + l + " m × " + w + " m and " + d + " mm thick. How many m³ of concrete is that?", kind: "number", answer: Math.round(l * w * d / 1000 * 1000) / 1000, tol: 0.01 }; },
      function (R) { var i = ri(R, 2, 16), r = pick(R, [10, 12, 15, 20, 24, 30, 60]);
        return { q: "A heater on a " + i * r + " V supply has a resistance of " + r + " Ω. How many amps does it draw?", kind: "number", answer: i }; },
      function (R) { var v = pick(R, [12, 24, 230, 240]), i = ri(R, 2, 15);
        return { q: "A tool draws " + i + " A from a " + v + " V supply. How many watts is that?", kind: "number", answer: v * i }; },
      function (R) { var k = ri(R, 1, 3) * 0.25, t = pick(R, [[4, 3, 5], [12, 5, 13], [8, 6, 10]]);
        return { q: "A rafter runs " + t[0] * k + " m across and rises " + t[1] * k + " m. How long is it (m)?", kind: "number", answer: t[2] * k, tol: 0.01 }; },
      function (R) { var tot = 6 * ri(R, 2, 20);
        return { q: "Concrete is mixed 1 : 2 : 3 (cement : sand : gravel). For " + tot + " buckets in total, how many buckets of cement?", kind: "number", answer: tot / 6 }; },
      function (R) { var a = ri(R, 30, 140), cov = pick(R, [10, 12, 16]), coats = pick(R, [1, 2]);
        return { q: "Walls of " + a + " m² need " + coats + " coat" + (coats > 1 ? "s" : "") + ". The paint covers " + cov + " m² a litre. How many whole litres must you buy?", kind: "number", answer: Math.ceil(a * coats / cov) }; },
      function (R) { var span = ri(R, 3, 9) * 900, gap = 450;
        return { q: "Floor joists go at " + gap + " mm centres across a " + span / 1000 + " m floor, with one at each end. How many joists?", kind: "number", answer: span / gap + 1 }; },
    ],
  };
  MATH.work = MATH.hs.slice(0, 6).concat(MATH.trade.slice(0, 4));

  /* ---------------- words: our own lists ---------------- */
  var WORDS = {
    hs: ["picture", "harvest", "journey", "kitchen", "library", "mineral", "orchard", "quarrel", "science", "volcano", "balance",
         "captain", "diamond", "factory", "gravity", "horizon", "justice", "lantern", "mystery", "network", "pyramid", "rainbow",
         "squirrel", "umbrella", "universe", "vitamin", "whisper", "absolute", "calendar", "elephant", "festival", "hospital",
         "keyboard", "magnetic", "mountain", "notebook", "platform", "strategy", "sunlight", "telescope", "treasure", "wildlife",
         "electric", "molecule", "equation", "dolphin", "blanket", "cabinet", "chimney", "compass"],
    college: ["photosynthesis", "metamorphosis", "constitution", "hypothesis", "parliament", "philosophy", "equilibrium",
              "democracy", "archaeology", "chromosome", "thermometer", "electricity", "laboratory", "mathematics", "temperature",
              "renaissance", "infrastructure", "biodiversity", "acceleration", "kaleidoscope", "magnificent", "questionnaire",
              "conscientious", "entrepreneur", "bureaucracy", "pharmaceutical", "thermodynamics", "photographer", "jurisdiction",
              "metabolism", "hypothermia", "manuscript", "observatory", "bibliography", "chronological"],
  };
  // [word, closest meaning, three others] - written for this game
  var SYN = {
    hs: [["abundant", "plentiful", "scarce", "hostile", "fragile"], ["candid", "frank", "sly", "bitter", "timid"],
         ["diligent", "hard-working", "lazy", "clumsy", "noisy"], ["ephemeral", "short-lived", "eternal", "heavy", "sacred"],
         ["frugal", "thrifty", "wasteful", "angry", "generous"], ["gregarious", "sociable", "shy", "greedy", "careful"],
         ["lucid", "clear", "murky", "lazy", "loud"], ["meticulous", "precise", "careless", "quick", "bold"],
         ["obsolete", "outdated", "modern", "costly", "rare"], ["pragmatic", "practical", "idealistic", "cruel", "vague"],
         ["reticent", "reserved", "talkative", "angry", "honest"], ["tenacious", "persistent", "weak", "sudden", "tidy"],
         ["benign", "harmless", "harmful", "wealthy", "shiny"], ["cogent", "convincing", "weak", "ugly", "sleepy"],
         ["lethargic", "sluggish", "energetic", "clever", "cheerful"], ["arduous", "difficult", "easy", "brief", "noisy"],
         ["scrutinise", "examine", "ignore", "praise", "destroy"], ["volatile", "unstable", "steady", "hollow", "polite"]],
    college: [["obfuscate", "obscure", "clarify", "celebrate", "assemble"], ["perfunctory", "cursory", "thorough", "generous", "joyful"],
              ["pusillanimous", "cowardly", "brave", "greedy", "tiny"], ["recalcitrant", "unruly", "obedient", "quiet", "ancient"],
              ["sycophant", "flatterer", "critic", "leader", "stranger"], ["loquacious", "talkative", "silent", "sour", "slow"],
              ["ineffable", "indescribable", "obvious", "useless", "tasty"], ["equivocal", "ambiguous", "clear", "equal", "furious"],
              ["quotidian", "everyday", "rare", "quarterly", "holy"], ["sanguine", "optimistic", "gloomy", "furious", "tired"],
              ["intransigent", "uncompromising", "flexible", "temporary", "silent"], ["perspicacious", "perceptive", "dull", "sweaty", "stubborn"],
              ["anachronistic", "out of its time", "punctual", "immortal", "fashionable"], ["magnanimous", "generous", "petty", "fearful", "sleepy"],
              ["esoteric", "obscure", "popular", "external", "simple"], ["laconic", "terse", "wordy", "lazy", "cheerful"],
              ["obsequious", "servile", "defiant", "obvious", "hidden"], ["inexorable", "relentless", "gentle", "uncertain", "costly"]],
  };
  function scramble(R, w) { var s = w; for (var n = 0; n < 20 && s === w; n++) s = shuffle(R, w.split("")).join(""); return s; }
  function holes(R, w) {
    var a = w.split(""), idx = shuffle(R, a.map(function (_, i) { return i; }).slice(1)), n = Math.max(2, Math.round(w.length * 0.4));
    idx.slice(0, n).forEach(function (i) { a[i] = "_"; });
    return a.join(" ");
  }
  var WORD = {
    anagram: function (R, lv) { var w = pick(R, WORDS[lv]); return { q: "Unscramble this word:  " + scramble(R, w).toUpperCase(), kind: "word", answer: w, hint: w.length + " letters" }; },
    missing: function (R, lv) { var w = pick(R, WORDS[lv]); return { q: "Fill in the missing letters:  " + holes(R, w).toUpperCase(), kind: "word", answer: w, hint: "type the whole word" }; },
    synonym: function (R, lv) { var s = pick(R, SYN[lv]); return { q: "Which is closest in meaning to  “" + s[0] + "”?", kind: "choice", choices: shuffle(R, s.slice(1)), answer: s[1] }; },
  };

  /* ---------------- quiz: our own bank [question, right, wrong, wrong, wrong] ---------------- */
  var QUIZ = {
    hs: [
      ["What is the chemical symbol for sodium?", "Na", "So", "Sd", "Sn"],
      ["Which organelle is the main site of aerobic respiration?", "Mitochondrion", "Ribosome", "Golgi apparatus", "Lysosome"],
      ["What is the SI unit of electrical resistance?", "Ohm", "Volt", "Ampere", "Watt"],
      ["About how fast does light travel in a vacuum?", "300,000 km/s", "30,000 km/s", "3,000 km/s", "3,000,000 km/s"],
      ["Which gas makes up about 78% of Earth's atmosphere?", "Nitrogen", "Oxygen", "Argon", "Carbon dioxide"],
      ["What is the pH of a neutral solution at 25 °C?", "7", "0", "14", "1"],
      ["Who stated the three laws of motion in 1687?", "Isaac Newton", "Galileo Galilei", "Johannes Kepler", "Albert Einstein"],
      ["Which blood vessels carry blood away from the heart?", "Arteries", "Veins", "Capillaries", "Venules"],
      ["In DNA, adenine pairs with which base?", "Thymine", "Cytosine", "Guanine", "Uracil"],
      ["What is the derivative of sin x?", "cos x", "-cos x", "-sin x", "tan x"],
      ["What is log₁₀(1000)?", "3", "2", "4", "30"],
      ["What do the interior angles of a hexagon add up to?", "720°", "540°", "900°", "1080°"],
      ["Which planet has the shortest year?", "Mercury", "Venus", "Mars", "Earth"],
      ["In which year did the First World War begin?", "1914", "1918", "1939", "1905"],
      ["In which year was the Treaty of Versailles signed?", "1919", "1918", "1921", "1945"],
      ["Which civilisation built Machu Picchu?", "Inca", "Aztec", "Maya", "Olmec"],
      ["What is the capital of Canada?", "Ottawa", "Toronto", "Vancouver", "Montreal"],
      ["Which is the longest river in Africa?", "Nile", "Congo", "Niger", "Zambezi"],
      ["Which is the largest ocean?", "Pacific", "Atlantic", "Indian", "Southern"],
      ["Who wrote the novel Pride and Prejudice?", "Jane Austen", "Charlotte Brontë", "George Eliot", "Mary Shelley"],
      ["Who wrote the play Macbeth?", "William Shakespeare", "Christopher Marlowe", "Ben Jonson", "John Webster"],
      ["What is inflation?", "A general rise in prices", "A fall in unemployment", "A rise in exports", "A cut in interest rates"],
      ["If demand rises and supply stays the same, the price usually…", "rises", "falls", "stays the same", "drops to zero"],
      ["What does GDP stand for?", "Gross domestic product", "General domestic price", "Gross debt position", "Government development plan"],
      ["Which process do plants use to make glucose from light?", "Photosynthesis", "Respiration", "Transpiration", "Fermentation"],
      ["What is the atomic number of carbon?", "6", "12", "8", "14"],
      ["Which of these is a noble gas?", "Neon", "Nitrogen", "Chlorine", "Hydrogen"],
      ["Which particle carries a negative charge?", "Electron", "Proton", "Neutron", "Alpha particle"],
      ["What is the formula for kinetic energy?", "½mv²", "mgh", "mv", "ma"],
      ["About how fast do falling objects accelerate near Earth's surface?", "9.8 m/s²", "98 m/s²", "0.98 m/s²", "6.7 m/s²"],
      ["Which of these is a prime number?", "97", "91", "87", "51"],
      ["What is 15% of 240?", "36", "32", "40", "24"],
      ["What is the integral of 1/x dx?", "ln|x| + C", "x² + C", "-1/x² + C", "eˣ + C"],
      ["Which country first gave women the vote in national elections, in 1893?", "New Zealand", "Australia", "United Kingdom", "United States"],
      ["In which year did the Australian colonies federate?", "1901", "1788", "1850", "1919"],
      ["Who was the first person to walk on the Moon?", "Neil Armstrong", "Buzz Aldrin", "Yuri Gagarin", "John Glenn"],
      ["In which year did the Berlin Wall fall?", "1989", "1991", "1961", "1975"],
      ["In which year did the French Revolution begin?", "1789", "1776", "1815", "1848"],
      ["Which language has the most native speakers?", "Mandarin Chinese", "English", "Spanish", "Hindi"],
      ["What is the hardest natural mineral?", "Diamond", "Quartz", "Corundum", "Topaz"],
      ["What does a catalyst do?", "Speeds up a reaction without being used up", "Is used up to speed up a reaction", "Stops a reaction", "Changes what a reaction makes"],
      ["What is the SI unit of frequency?", "Hertz", "Newton", "Joule", "Pascal"],
      ["Which equation is Ohm's law?", "V = IR", "P = IV", "F = ma", "E = mc²"],
      ["What is the main job of red blood cells?", "Carry oxygen", "Fight infection", "Clot the blood", "Make antibodies"],
      ["Which part of the brain mainly controls balance and coordination?", "Cerebellum", "Cerebrum", "Medulla", "Hypothalamus"],
      ["What is the mean of 4, 8, 15, 16, 23 and 42?", "18", "15.5", "16", "21"],
      ["What is the median of 3, 9, 4, 7 and 12?", "7", "9", "8", "6"],
      ["If x² = 49 and x < 0, what is x?", "-7", "7", "-49", "0"],
      ["What is the slope of the line through (1, 2) and (3, 8)?", "3", "2", "6", "4"],
      ["Which element has the symbol Fe?", "Iron", "Fluorine", "Lead", "Tin"],
      ["Who painted the ceiling of the Sistine Chapel?", "Michelangelo", "Leonardo da Vinci", "Raphael", "Donatello"],
      ["In which country did the Renaissance begin?", "Italy", "France", "England", "Spain"],
      ["In which year was Magna Carta sealed?", "1215", "1066", "1415", "1588"],
      ["The Cold War was mainly between which two powers?", "The USA and the USSR", "The UK and France", "China and Japan", "Germany and Italy"],
      ["Which instrument measures air pressure?", "Barometer", "Thermometer", "Hygrometer", "Anemometer"],
      ["How many syllables does a traditional haiku have in total?", "17", "14", "12", "19"],
      ["In “the boy's book”, what does the apostrophe show?", "Possession", "A contraction", "A plural", "A quotation"],
      ["What is the opposite of “benevolent”?", "Malevolent", "Generous", "Benign", "Lenient"],
      ["Which device compares two things using “like” or “as”?", "Simile", "Metaphor", "Personification", "Hyperbole"],
      ["Which of these is a renewable energy source?", "Wind", "Coal", "Natural gas", "Oil"],
      ["Which greenhouse gas comes mostly from burning fossil fuels?", "Carbon dioxide", "Oxygen", "Nitrogen", "Helium"],
      ["What is the simple interest on $1,000 at 5% a year for 3 years?", "$150", "$50", "$157.63", "$300"],
      ["A car travels 150 km in 2 hours. What is its average speed?", "75 km/h", "300 km/h", "50 km/h", "152 km/h"],
      ["What is the binary number 1011 in decimal?", "11", "13", "9", "10"],
      ["What is hexadecimal FF in decimal?", "255", "256", "15", "240"],
      ["Who, with Alfred Russel Wallace, put forward evolution by natural selection?", "Charles Darwin", "Gregor Mendel", "Louis Pasteur", "Jean-Baptiste Lamarck"],
      ["Whose experiments with pea plants founded genetics?", "Gregor Mendel", "Charles Darwin", "Louis Pasteur", "Robert Hooke"],
      ["What is the smallest unit of life?", "The cell", "The atom", "The organ", "The tissue"],
      ["Mount Everest sits on the border of Nepal and which other country?", "China", "India", "Bhutan", "Pakistan"],
      ["On which continent is the Sahara Desert?", "Africa", "Asia", "Australia", "South America"],
    ],
    college: [
      ["What are the eigenvalues of the 2×2 identity matrix?", "1 and 1", "0 and 0", "1 and -1", "2 and 2"],
      ["What is the time complexity of binary search on a sorted array?", "O(log n)", "O(n)", "O(n log n)", "O(1)"],
      ["What is the worst-case time complexity of quicksort?", "O(n²)", "O(n log n)", "O(n)", "O(log n)"],
      ["What is the derivative of e^(2x)?", "2e^(2x)", "e^(2x)", "2x·e^(2x-1)", "e^(2x)/2"],
      ["What is ∫ x·eˣ dx?", "(x - 1)eˣ + C", "x·eˣ + C", "x²eˣ/2 + C", "(x + 1)eˣ + C"],
      ["Which law says the entropy of an isolated system never decreases?", "The second law of thermodynamics", "The first law of thermodynamics", "The third law of thermodynamics", "The zeroth law of thermodynamics"],
      ["Heisenberg's uncertainty principle limits how precisely we can know together…", "position and momentum", "mass and energy", "charge and spin", "time and temperature"],
      ["About what is Avogadro's number?", "6.022 × 10²³", "3.00 × 10⁸", "6.626 × 10⁻³⁴", "1.602 × 10⁻¹⁹"],
      ["About what is Planck's constant?", "6.626 × 10⁻³⁴ J·s", "6.022 × 10²³ J·s", "9.81 J·s", "1.38 × 10⁻²³ J·s"],
      ["Who wrote The Wealth of Nations (1776)?", "Adam Smith", "John Maynard Keynes", "Karl Marx", "David Ricardo"],
      ["Keynesian economics stresses…", "government spending to manage demand", "a fixed money supply", "the gold standard", "no role for government at all"],
      ["In long-run equilibrium under perfect competition, economic profit is…", "zero", "positive", "negative", "at its maximum"],
      ["What is opportunity cost?", "The value of the next best alternative given up", "The money price paid", "A cost already spent", "The total cost of production"],
      ["A central bank usually raises interest rates to…", "bring inflation down", "push inflation up", "weaken employment law", "raise government revenue"],
      ["Why is DNA replication called semi-conservative?", "Each new molecule keeps one original strand", "Both strands are made new", "Only half the genome is copied", "The bases are conserved but not the backbone"],
      ["Which enzyme unwinds the DNA double helix?", "Helicase", "Ligase", "DNA polymerase", "Primase"],
      ["Where does the Krebs cycle take place?", "The mitochondrial matrix", "The cytoplasm", "The nucleus", "The ribosome"],
      ["What holds the two strands of DNA together?", "Hydrogen bonds", "Ionic bonds", "Peptide bonds", "Metallic bonds"],
      ["What is the hybridisation of carbon in methane?", "sp³", "sp²", "sp", "sp³d"],
      ["Which is the ideal gas law?", "PV = nRT", "PV = nR/T", "P = nRTV", "PT = nRV"],
      ["What does a Fourier transform do to a signal?", "Splits it into its frequency components", "Removes its noise", "Doubles its sampling rate", "Turns it into a step function"],
      ["What is the determinant of a matrix with two identical rows?", "0", "1", "-1", "It depends on the rows"],
      ["A square matrix has an inverse exactly when…", "its determinant is not zero", "it is symmetric", "it has a zero row", "its trace is zero"],
      ["Bayes' theorem relates…", "P(A|B) to P(B|A)", "the mean to the variance", "a sample to its population size", "correlation to causation"],
      ["What is the variance of one roll of a fair six-sided die?", "35/12", "3.5", "17.5", "6"],
      ["Who proved the halting problem undecidable in 1936?", "Alan Turing", "Kurt Gödel", "John von Neumann", "Claude Shannon"],
      ["Gödel's incompleteness theorems are about…", "the limits of what formal systems can prove", "the speed of computers", "the size of infinite sets", "the shape of space-time"],
      ["Which data structure is first in, first out?", "Queue", "Stack", "Binary tree", "Heap"],
      ["Which normal form removes transitive dependencies?", "Third normal form", "First normal form", "Second normal form", "Fifth normal form"],
      ["What does TCP give that UDP does not?", "Reliable, ordered delivery", "Lower latency", "Broadcast to all hosts", "Smaller headers"],
      ["Who wrote the Critique of Pure Reason?", "Immanuel Kant", "G. W. F. Hegel", "David Hume", "René Descartes"],
      ["“I think, therefore I am” is linked with which philosopher?", "René Descartes", "John Locke", "Plato", "Friedrich Nietzsche"],
      ["Utilitarianism judges an action by…", "its consequences for overall wellbeing", "the duty behind it", "the character of the person", "divine command"],
      ["The Peace of Westphalia (1648) is linked with…", "the modern idea of state sovereignty", "the end of the Napoleonic Wars", "the founding of the United Nations", "the start of the Crusades"],
      ["Where did the Industrial Revolution begin?", "Great Britain", "France", "Germany", "The United States"],
      ["Which institutions came out of the Bretton Woods conference in 1944?", "The IMF and the World Bank", "NATO and the UN", "The EU and the ECB", "The WTO and OPEC"],
      ["The separation of powers is most closely linked with…", "Montesquieu", "Rousseau", "Hobbes", "Machiavelli"],
      ["About what is Earth's escape velocity?", "11.2 km/s", "7.9 km/s", "3.0 km/s", "42 km/s"],
      ["The Schwarzschild radius gives the size of…", "a black hole's event horizon", "a star's core", "an atom's nucleus", "a galaxy's disc"],
      ["Maxwell's equations describe…", "electromagnetism", "gravity", "the strong nuclear force", "fluid flow"],
      ["What is a p-value?", "The chance of data at least this extreme if the null hypothesis is true", "The chance the null hypothesis is true", "The size of the effect", "The power of the test"],
      ["The central limit theorem says that sample means tend towards…", "a normal distribution", "a uniform distribution", "zero", "the sample size"],
      ["Which is NOT an additive primary colour of light?", "Yellow", "Red", "Green", "Blue"],
      ["Whose explanation of the photoelectric effect won the 1921 Nobel Prize in Physics?", "Albert Einstein", "Max Planck", "Niels Bohr", "Ernest Rutherford"],
      ["What did the gold foil experiment show?", "Atoms have a small, dense nucleus", "Electrons have wave properties", "Light is made of photons", "Gold is radioactive"],
      ["What is the time complexity of merge sort?", "O(n log n)", "O(n²)", "O(n)", "O(log n)"],
      ["Which of these sorting algorithms is stable?", "Merge sort", "Heap sort", "Selection sort", "Quicksort (the usual version)"],
      ["Price elasticity of demand is -2. A 10% price rise changes quantity demanded by about…", "-20%", "-5%", "+20%", "-2%"],
      ["About what is the normal pH of human blood?", "7.4", "6.8", "7.0", "8.0"],
      ["Which hormone lowers blood glucose?", "Insulin", "Glucagon", "Adrenaline", "Cortisol"],
    ],
  };
  function quiz(R, lv) { var q = pick(R, QUIZ[lv === "college" ? "college" : "hs"]); return { q: q[0], kind: "choice", choices: shuffle(R, q.slice(1)), answer: q[1] }; }

  var SECS = { hs: 75, college: 100, trade: 75, work: 75 };
  /** a puzzle for a ring (hs | college | trade | work) and a topic (math | word | quiz | any) */
  function make(level, topic, R) {
    R = R || Math.random; level = SECS[level] ? level : "hs";
    if (!topic || topic === "any") topic = pick(R, level === "trade" ? ["math", "math", "quiz"] : ["math", "word", "quiz"]);
    var wl = level === "college" ? "college" : "hs", p;
    if (topic === "math") p = pick(R, MATH[level])(R);
    else if (topic === "word") p = WORD[pick(R, ["anagram", "missing", "synonym"])](R, wl);
    else p = quiz(R, level);
    p.level = level; p.topic = topic; p.secs = SECS[level] + (p.kind === "word" ? 15 : 0);
    if (typeof p.answer === "number" && !isFinite(p.answer)) return make(level, topic, R);
    return p;
  }
  function norm(t) { return String(t == null ? "" : t).toLowerCase().replace(/\s+/g, " ").trim(); }
  function num(t) { var s = String(t == null ? "" : t).replace(/[$,\s]/g, "").replace(/−/g, "-"); if (!/^-?\d*\.?\d+$/.test(s)) return NaN; return Number(s); }
  function fracVal(t) { var m = String(t == null ? "" : t).replace(/\s/g, "").replace(/−/g, "-").match(/^(-?\d+)(?:\/(\d+))?$/); if (!m) return NaN; return Number(m[1]) / (m[2] ? Number(m[2]) : 1); }
  /** is this the right answer? numbers within the tolerance (or 1e-9), fractions by value, words letter for letter */
  function check(p, given) {
    if (!p) return false;
    if (p.kind === "number") { var v = num(given); return isFinite(v) && Math.abs(v - p.answer) <= (p.tol || 1e-9); }
    if (p.kind === "fraction") { var a = fracVal(given), b = fracVal(p.answer); return isFinite(a) && Math.abs(a - b) < 1e-12; }
    if (p.kind === "word") return norm(given).replace(/[^a-z]/g, "") === norm(p.answer).replace(/[^a-z]/g, "");
    return norm(given) === norm(p.answer);
  }
  var API = { make: make, check: check, MATH: MATH, WORDS: WORDS, SYN: SYN, QUIZ: QUIZ, SECS: SECS, frac: frac, nCr: nCr };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.H3LifePuzzles = API;
})(typeof window !== "undefined" ? window : this);
