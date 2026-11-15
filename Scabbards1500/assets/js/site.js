(function () {
  var root = document.documentElement;
  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (!reduceMotion) root.classList.add("motion");

  /* ---------------- Masked reveal ---------------- */

  // Checked from the scroll loop with getBoundingClientRect, which (unlike
  // IntersectionObserver) is not affected by the element's own clip-path.
  var pendingReveals = [];
  var requestScrollUpdate = function () {};

  function checkReveals() {
    if (!pendingReveals.length) return;
    var limit = window.innerHeight * 0.92;
    pendingReveals = pendingReveals.filter(function (el) {
      if (!el.isConnected) return false;
      var rect = el.getBoundingClientRect();
      if (rect.height === 0 || rect.top > limit || rect.bottom < 0) return true;
      el.classList.add("in");
      var delay = parseFloat(el.style.getPropertyValue("--rd")) || 0;
      window.setTimeout(function () {
        el.classList.add("done");
      }, delay + 1100);
      return false;
    });
  }

  function reveal(el, delay) {
    if (reduceMotion || !el) return;
    el.classList.add("reveal");
    if (delay) el.style.setProperty("--rd", delay + "ms");
    pendingReveals.push(el);
    requestScrollUpdate();
  }

  /* ---------------- Floating decorations ---------------- */

  var SVG_NS = "http://www.w3.org/2000/svg";
  var ICONS = {
    bird: {
      viewBox: "0 0 40 18",
      d: "M1 9.5C6.5 3.5 12 3 20 10.5 28 3 33.5 3.5 39 9.5 33.5 7.6 27 9 20 15.5 13 9 6.5 7.6 1 9.5Z",
    },
    feather: {
      viewBox: "0 0 32 52",
      d: "M22 2C31 14 29 32 12 46M22 2C11 13 7 30 12 46M12 46 7 51M19 9l6 3M16 16l10 3M14 23l11 2M13 30l10 1M12 37l7 0M18 12l-7 4M15 20l-7 5M14 28l-6 5",
    },
    // White gull with spread wings in a three-quarter view: each wing is one
    // clean crescent tapering to a point, near wing up-left, far wing dropping
    // right. Light blueprint outline with a faint dot fill.
    gull: {
      viewBox: "0 0 210 84",
      parts: [
        ["d-body", "M2 16C22 6 52 2 72 10C84 15 92 24 98 33C101 26 106 21 113 20C119 19 124 20 128 22L135 21.5L127 26.5C125 31 125 36 127 40C129 43 132 45 136 46C160 44 188 44 198 50C204 56 207 68 208 82C196 66 166 60 128 61C121 61.5 117 63 116 66L118 78L93 72L97 56C74 42 40 26 2 16Z"],
        ["d-dots", "M2 16C22 6 52 2 72 10C84 15 92 24 98 33C101 26 106 21 113 20C119 19 124 20 128 22L135 21.5L127 26.5C125 31 125 36 127 40C129 43 132 45 136 46C160 44 188 44 198 50C204 56 207 68 208 82C196 66 166 60 128 61C121 61.5 117 63 116 66L118 78L93 72L97 56C74 42 40 26 2 16Z"],
      ],
    },
    // Flat cumulus with a pale shaded base.
    cloud: {
      viewBox: "0 0 160 56",
      parts: [
        ["c-body", "M16 50C6 50 4 39 13 36.5C12 27 24 21 33 26C38 13 56 9 67 19C74 7 97 7 102 21C109 15 123 17 126 28C138 26 151 34 146 44C153 46 151 50 144 50Z"],
        ["c-shade", "M10.5 45C30 47 120 47 148.5 45.6C149.4 48.6 147.5 50 144 50H16C13 50 11.2 47.8 10.5 45Z"],
      ],
    },
    // Stylised wind streaks, a line-art cloud.
    cloudline: {
      viewBox: "0 0 120 30",
      parts: [["c-line", "M22 7H78M8 15H112M34 23H66"]],
    },
  };

  function icon(name) {
    var spec = ICONS[name];
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", spec.viewBox);
    svg.setAttribute("aria-hidden", "true");
    (spec.parts || [["", spec.d]]).forEach(function (part) {
      var path = document.createElementNS(SVG_NS, "path");
      if (part[0]) path.setAttribute("class", part[0]);
      path.setAttribute("d", part[1]);
      svg.appendChild(path);
    });
    return svg;
  }

  // Gull, bird, feather and cloud placeholders get their SVG plus a wrapper that hovers gently.
  function hydrateIcons(scope) {
    var kinds = ["gull", "bird", "feather", "cloud", "cloudline"];
    var selector = kinds.map(function (k) { return ".fx-" + k + ":empty"; }).join(", ");
    scope.querySelectorAll(selector).forEach(function (el, i) {
      var inner = document.createElement("span");
      inner.style.setProperty("--hover", (5 + (i % 4) * 1.3).toFixed(1) + "s");
      var name = kinds.filter(function (k) { return el.classList.contains("fx-" + k); })[0];
      inner.appendChild(icon(name));
      el.appendChild(inner);
    });
  }

  // spec: [classes, x, y, depth, extra]; extra may hold w, h, s, tilt, flip, text.
  function fxField(specs) {
    var field = h("div", { class: "fx-field", "aria-hidden": "true" });
    specs.forEach(function (spec) {
      var extra = spec[4] || {};
      var el = h("span", { class: "fx " + spec[0], "data-depth": String(spec[3]) }, extra.text ? [extra.text] : []);
      el.style.setProperty("--x", spec[1]);
      el.style.setProperty("--y", spec[2]);
      if (extra.w) el.style.setProperty("--w", extra.w);
      if (extra.h) el.style.setProperty("--h", extra.h);
      if (extra.s) el.style.setProperty("--s", extra.s);
      if (extra.tilt) el.style.setProperty("--tilt", extra.tilt);
      if (extra.flip) el.style.setProperty("--flip", "-1");
      field.appendChild(el);
    });
    hydrateIcons(field);
    return field;
  }

  var SECTION_FX = [
    function (label) {
      return [
        ["fx-label fx-hide-sm", "46%", "1.4rem", 0.12, { text: label }],
        ["fx-frame fx-hide-sm", "72%", "-1.25rem", 0.3, { w: "8.5rem", h: "4.25rem" }],
        ["fx-gull", "82%", "-2.5rem", 0.55, { s: "84px", tilt: "6deg", flip: true }],
        ["fx-cloud fx-hide-sm", "58%", "-2.75rem", 0.2, { s: "130px" }],
      ];
    },
    function (label) {
      return [
        ["fx-label fx-hide-sm", "46%", "1.4rem", 0.12, { text: label }],
        ["fx-ring fx-hide-sm", "86%", "-2.5rem", 0.22, { w: "6.5rem" }],
        ["fx-gull fx-hide-sm", "68%", "-2.25rem", 0.45, { s: "64px", tilt: "10deg" }],
        ["fx-cloudline", "40%", "0.4rem", 0.3, { s: "90px" }],
      ];
    },
    function (label) {
      return [
        ["fx-label fx-hide-sm", "46%", "1.4rem", 0.12, { text: label }],
        ["fx-gull", "84%", "-0.75rem", 0.62, { s: "78px", tilt: "-8deg", flip: true }],
        ["fx-cloud", "64%", "-1rem", 0.22, { s: "110px" }],
      ];
    },
  ];

  var INTRO_FX = [
    ["fx-slab", "58%", "1.5rem", 0.14, { w: "40%", h: "85%" }],
    ["fx-frame fx-hide-sm", "70%", "2.5rem", 0.3, { w: "9rem", h: "5rem" }],
    ["fx-label fx-hide-sm", "54%", "6.5rem", 0.2, { text: "// ARCHIVE" }],
    ["fx-gull", "82%", "1.25rem", 0.55, { s: "88px", tilt: "6deg", flip: true }],
    ["fx-cloud fx-hide-sm", "60%", "62%", 0.2, { s: "120px" }],
  ];

  var LIST_FX = [
    ["fx-label fx-vertical fx-hide-sm", "101.5%", "3rem", 0.2, { text: "INDEX // ENTRIES" }],
  ];

  // Shared dot pattern used as the blueprint fill inside gull silhouettes.
  function injectPatterns() {
    if (document.getElementById("fx-dotpat")) return;
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    svg.innerHTML =
      '<defs><pattern id="fx-dotpat" width="7" height="7" patternUnits="userSpaceOnUse">' +
      '<circle cx="1.5" cy="1.5" r=".75" fill="#3a6fd8" fill-opacity=".4"/></pattern></defs>';
    document.body.appendChild(svg);
  }

  // Foreground layer for list pages: sits above the cards, overlaps their
  // edges, and uses negative depth so it scrolls slightly faster than the page.
  var LIST_TOP_FX = [
    ["fx-gull", "84%", "5%", -0.12, { s: "96px", tilt: "-6deg", flip: true }],
    ["fx-cloud fx-hide-sm", "-1%", "22%", -0.06, { s: "150px" }],
    ["fx-gull fx-hide-sm", "-1%", "38%", -0.16, { s: "74px", tilt: "8deg" }],
    ["fx-target fx-hide-sm", "90%", "47%", -0.08, { w: "4rem", h: "2.25rem" }],
    ["fx-gull", "92%", "64%", -0.14, { s: "82px", tilt: "-10deg", flip: true }],
    ["fx-cloud", "84%", "80%", -0.05, { s: "130px" }],
    ["fx-gull fx-hide-sm", "36%", "93%", -0.18, { s: "70px", tilt: "6deg" }],
  ];



  // Wrap the sidebar photo in a stage; scrolling wipes it away to reveal the OC.
  // Sidebar: photo slot, then name/school, then the OC panel. CSS drives the
  // swap from --swap (scroll progress over the first stretch of the page).
  var ocItems = [];
  var ocMarks = null;

  // Callouts breathe with the scroll: each one swells, shrinks and drops out
  // on its own phase, so the set keeps changing as the page moves.
  function updateOc() {
    if (!ocItems.length) return;
    var y = window.scrollY;
    var sp = clamp(y / Math.max(1, root.scrollHeight - window.innerHeight), 0, 1);
    if (ocMarks) {
      // Scan line sits at the same height as the dot level inside the body.
      var scan = ocMarks.querySelector(".hud-scan");
      scan.setAttribute("transform", "translate(0 " + (186 * (1 - sp)).toFixed(2) + ")");
      scan.querySelector("text").textContent = ("00" + Math.round(sp * 100)).slice(-3);
      if (!reduceMotion) {
        ocMarks.querySelector(".hud-tilt").setAttribute("d",
          "M0 " + (40 + sp * 90).toFixed(1) + "L135.6 " + (150 - sp * 110).toFixed(1));
        ocMarks.querySelector(".hud-ruler").style.strokeDashoffset = (y * 0.03).toFixed(2);
        [].forEach.call(ocMarks.querySelectorAll(".hud-grid"), function (g, i) {
          var gx = +g.getAttribute("data-x"), gy = +g.getAttribute("data-y");
          var cols = +g.getAttribute("data-cols"), rows = +g.getAttribute("data-rows");
          var dir = i % 2 ? -1 : 1;
          // grid lines slide; the lit cell steps through the patch
          ocMarks.querySelectorAll("pattern")[i].setAttribute("patternTransform",
            "translate(" + gx + " " + (gy + ((dir * y * 0.02) % 5)).toFixed(2) + ")");
          var n = Math.floor(y / 60 + i * 7) % (cols * rows);
          var cell = g.querySelector(".hud-cell");
          cell.setAttribute("x", gx + (n % cols) * 5);
          cell.setAttribute("y", gy + (dir > 0 ? Math.floor(n / cols) : rows - 1 - Math.floor(n / cols)) * 5);
        });
        [].forEach.call(ocMarks.querySelectorAll(".hud-hbar"), function (bar, i) {
          bar.setAttribute("width", (8 + 6.5 * (1 + Math.sin(y / 340 + i * 2.1))).toFixed(2));
        });
      }
    }
    if (reduceMotion) return;
    ocItems.forEach(function (item, i) {
      var v = Math.sin(y / 420 + i * 1.7 + 0.9);
      item.style.opacity = clamp((v + 0.8) / 0.4, 0, 1).toFixed(3);
      var zoom = item.querySelector(".hud-zoom");
      if (!zoom) return;
      var cx = item.getAttribute("data-cx"), cy = item.getAttribute("data-cy");
      zoom.setAttribute("transform", "translate(" + cx + " " + cy + ") scale(" + (1 + 0.16 * v).toFixed(3) +
        ") translate(-" + cx + " -" + cy + ")");
    });
  }

  function initAvatar() {
    var avatar = document.querySelector(".sidebar .avatar");
    if (!avatar || avatar.parentNode.classList.contains("avatar-slot")) return;
    var top = avatar.parentNode;
    var slot = h("div", { class: "avatar-slot" });
    top.insertBefore(slot, avatar);
    slot.appendChild(avatar);
    // The OC art comes in layers: wings behind, the figure, three sparkles in
    // front. Wings and sparkles drift on their own (CSS). A blueprint-style
    // overlay frames the eyes and repeats them enlarged in a callout.
    var base = avatar.querySelector("img").getAttribute("src").replace(/profile\.jpg$/, "");
    function layer(name, cls, alt) {
      return h("img", { src: base + name + ".webp", class: cls, alt: alt || "", decoding: "sync" });
    }
    // The bare body is a window (CSS mask): it fills with colour as the page
    // is read, and glows where the pointer is.
    // Seen through the body: the same light line-art as the page background.
    // Blueprint dots rise with reading progress; clouds, wind streaks and
    // gulls drift across; a faint wash follows the pointer.
    function ocWindow() {
      var drift = [
        ["fx-cloud", "16%", "46px", "19s", "-4s"],
        ["fx-cloudline", "34%", "40px", "15s", "-9s"],
        ["fx-gull", "50%", "30px", "23s", "-14s"],
        ["fx-cloud", "66%", "38px", "21s", "-1s"],
        ["fx-cloudline", "84%", "34px", "17s", "-11s"],
      ].map(function (d) {
        var el = h("span", { class: "oc-drift " + d[0] });
        el.style.setProperty("--y", d[1]);
        el.style.setProperty("--s", d[2]);
        el.style.setProperty("--dur", d[3]);
        el.style.animationDelay = d[4];
        return el;
      });
      var fill = h("div", { class: "oc-fill", "aria-hidden": "true" },
        [h("div", { class: "oc-level" })].concat(drift, [h("div", { class: "oc-glow" })]));
      hydrateIcons(fill);
      return fill;
    }
    var oc = h("div", { class: "oc" }, [
      h("div", { class: "oc-disc", "aria-hidden": "true" }),
      // colour layer of the wing: the same four feathers as flat blocks, on the
      // same roots and at the same angles, set a little further out
      layer("oc-fan1", "oc-wing oc-wing-1 oc-fan"),
      layer("oc-fan2", "oc-wing oc-wing-2 oc-fan"),
      layer("oc-fan3", "oc-wing oc-wing-3 oc-fan"),
      layer("oc-fan4", "oc-wing oc-wing-4 oc-fan"),
      // four feathers, outermost first; CSS fans them open with page progress
      layer("oc-wing1", "oc-wing oc-wing-1"),
      layer("oc-wing2", "oc-wing oc-wing-2"),
      layer("oc-wing3", "oc-wing oc-wing-3"),
      layer("oc-wing4", "oc-wing oc-wing-4"),
      layer("oc", "oc-body", "Scabbard, original character"),
      ocWindow(),
      layer("oc-star1", "oc-star oc-star-1"),
      layer("oc-star2", "oc-star oc-star-2"),
      layer("oc-star3", "oc-star oc-star-3"),
    ]);
    var hud = document.createElementNS(SVG_NS, "svg");
    hud.setAttribute("class", "oc-hud");
    hud.setAttribute("viewBox", "0 0 135.6 186");
    hud.setAttribute("aria-hidden", "true");
    // Handles: small squares on the corners and top/bottom midpoints of a box.
    function handles(x, y, w, hgt, size) {
      return [[x, y], [x + w, y], [x, y + hgt], [x + w, y + hgt], [x + w / 2, y], [x + w / 2, y + hgt]]
        .map(function (pt) {
          return '<rect class="hud-handle" x="' + (pt[0] - size / 2) + '" y="' + (pt[1] - size / 2) +
            '" width="' + size + '" height="' + size + '"/>';
        })
        .join("");
    }
    // A framed thumbnail from the colour illustration, with a label underneath
    // and a leader line to the matching spot on the figure. The frame is its own
    // group so scrolling can zoom it; the whole item fades as one.
    function callout(name, x, y, w, hgt, label, anchorEnd, from, to) {
      return '<g class="hud-item" data-cx="' + (x + w / 2) + '" data-cy="' + (y + hgt / 2) + '">' +
        (from ? '<path class="hud-leader" d="M' + from.join(" ") + "L" + to.join(" ") + '"/>' +
          '<circle class="hud-dot" cx="' + to[0] + '" cy="' + to[1] + '" r="1"/>' : "") +
        '<g class="hud-zoom"><image href="' + base + name + '.webp" x="' + x + '" y="' + y + '" width="' + w +
        '" height="' + hgt + '" preserveAspectRatio="none"/><rect class="hud-select" x="' + x + '" y="' + y +
        '" width="' + w + '" height="' + hgt + '"/>' + handles(x, y, w, hgt, 2) +
        '<text class="hud-label" x="' + (anchorEnd ? x + w : x) + '" y="' + (y + hgt + 5.2) + '"' +
        (anchorEnd ? ' text-anchor="end"' : "") + ">" + label + "</text></g></g>";
    }
    // Construction marks that move with the scroll (see updateOc): two grid
    // patches whose lines slide and whose lit cell steps along, a ruler, a
    // tilting guide line, and a scan line at the reading-progress height.
    function grid(id, x, y, cols, rows) {
      return '<pattern id="' + id + '" width="5" height="5" patternUnits="userSpaceOnUse">' +
        '<path class="hud-grid-line" d="M5 0H0V5"/></pattern>' +
        '<g class="hud-grid" data-x="' + x + '" data-y="' + y + '" data-cols="' + cols + '" data-rows="' + rows + '">' +
        '<rect class="hud-cell" x="' + x + '" y="' + y + '" width="5" height="5"/>' +
        '<rect class="hud-grid-box" x="' + x + '" y="' + y + '" width="' + cols * 5 + '" height="' + rows * 5 +
        '" fill="url(#' + id + ')"/></g>';
    }
    var marks =
      '<path class="hud-tilt" d="M0 60L135.6 130"/>' +
      grid("oc-grid-a", 4, 6, 6, 5) + grid("oc-grid-b", 103, 128, 6, 8) +
      '<path class="hud-ruler" d="M2 44V94"/><path class="hud-ruler-line" d="M0.6 44V94"/>' +
      '<g class="hud-scan"><path d="M34 0H102M34 -1.6V1.6M102 -1.6V1.6"/>' +
      '<text class="hud-label" x="35.5" y="-1.6">000</text></g>';
    // Solid pieces right of the arm: a tag with three data bars (updateOc
    // changes their lengths with the scroll) and an edge marker.
    var solids =
      '<rect class="hud-solid" x="112" y="54" width="21" height="6.4"/>' +
      '<text class="hud-tag-text" x="113.6" y="58.9">OC-01</text>' +
      ["hud-solid", "hud-solid-mid", "hud-solid-light"].map(function (c, i) {
        return '<rect class="hud-hbar ' + c + '" x="112" y="' + (63 + i * 4.6) + '" width="' + (20 - i * 5) + '" height="3"/>';
      }).join("") +
      '<path class="hud-solid-mid" d="M135.6 84l-5.5 3.6 5.5 3.6Z"/>';
    hud.innerHTML = marks + solids +
      // dotted range arc with tick labels, lower left
      '<g class="hud-item"><path class="hud-dots" d="M14 184A160 160 0 0 1 10 144"/>' +
      '<g class="hud-text"><circle cx="9.6" cy="152" r="0.9"/><text x="12.6" y="153.7">A1</text>' +
      '<circle cx="10.4" cy="163" r="0.9"/><text x="13.4" y="164.7">A2</text>' +
      '<circle cx="11.9" cy="174" r="0.9"/><text x="14.9" y="175.7">A3</text></g></g>' +
      callout("oc-eyes", 78, -17, 50, 16.1, "OC-01 // EYE", true, [78, -7], [73.4, 23.2]) +
      // the top sits right on the chest, no leader needed
      callout("oc-top", 60.3, 47.5, 21, 21, "OC-02 // TOP", false) +
      callout("oc-shorts", 106, 98, 26, 19.5, "OC-03 // SHORTS", true, [106, 106], [80.4, 85]) +
      callout("oc-cape", 2, 112, 30, 25, "OC-04 // CAPE", false, [14, 112], [20, 72]);
    oc.appendChild(hud);
    ocItems = [].slice.call(hud.querySelectorAll(".hud-item"));
    ocMarks = hud;
    // Pointer anywhere over the sidebar lights the body where it is closest.
    var side = top.closest ? top.closest(".sidebar") : null;
    // Construction marks around the name block and beside the links. They are
    // plain spans; CSS moves them from --sp (page progress).
    function sideMarks(cls, names) {
      return h("div", { class: "side-marks " + cls, "aria-hidden": "true" },
        names.map(function (n) { return h("span", { class: n }, n === "sm-coord" ? ["32.88\u00b0N 117.23\u00b0W"] : []); }));
    }
    var info = slot.nextElementSibling;
    if (info) {
      info.classList.add("side-info");
      info.appendChild(sideMarks("side-marks-top", ["sm-corner sm-tl", "sm-corner sm-br", "sm-rule", "sm-cross", "sm-coord"]));
    }
    var links = side && side.querySelector(".social-nav");
    if (links) links.appendChild(sideMarks("side-marks-bottom", ["sm-vline", "sm-grid", "sm-ring", "sm-seg"]));
    if (side) {
      side.addEventListener("pointermove", function (ev) {
        var r = oc.getBoundingClientRect();
        if (!r.width || !r.height) return;
        oc.style.setProperty("--mx", (((ev.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
        oc.style.setProperty("--my", (((ev.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
        oc.classList.add("is-near");
      });
      side.addEventListener("pointerleave", function () {
        oc.classList.remove("is-near");
      });
    }
    top.appendChild(h("div", { class: "oc-slot" }, [h("div", { class: "oc-reveal" }, [oc])]));
  }

  function initDecor() {
    initAvatar();
    injectPatterns();
    hydrateIcons(document);

    document.querySelectorAll(".home-section").forEach(function (section, index) {
      var heading = section.querySelector("h3");
      var name = heading ? heading.textContent.trim().toUpperCase() : "";
      var label = "0" + (index + 1) + " // " + name;
      section.insertBefore(fxField(SECTION_FX[index % SECTION_FX.length](label)), section.firstChild);
    });

    document.querySelectorAll(".page-intro:not(.hero-copy)").forEach(function (intro) {
      intro.insertBefore(fxField(INTRO_FX), intro.firstChild);
    });

    document.querySelectorAll(".post-wrap").forEach(function (wrap) {
      wrap.insertBefore(fxField(LIST_FX), wrap.firstChild);
      var top = fxField(LIST_TOP_FX);
      top.classList.add("fx-over");
      wrap.appendChild(top);
    });

    var nav = document.querySelector(".top-nav");
    if (nav && !nav.querySelector(".nav-flight")) {
      var bird = h("span", { class: "nav-bird" });
      bird.appendChild(icon("bird"));
      nav.appendChild(
        h("div", { class: "nav-flight", "aria-hidden": "true" }, [h("span", { class: "nav-flight-line" }), bird])
      );
    }
  }

  // Small seeded generator so the scattered layout is the same on every visit.
  function seeded(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Overlay pieces: a few distinct shapes only, so lists don't get busy.
  var OVERLAY_KINDS = [
    function (r) { return ["fx-gull", { s: Math.round(44 + r() * 24) + "px", tilt: Math.round(r() * 24 - 12) + "deg", flip: r() < 0.5 }]; },
    function (r) { return ["fx-cloud", { s: Math.round(64 + r() * 40) + "px" }]; },
    function (r) { return ["fx-cloudline", { s: Math.round(60 + r() * 30) + "px" }]; },
    function (r) { return ["fx-dash", { w: Math.round(80 + r() * 120) + "px" }]; },
  ];
  // Scatter small pieces over a rendered list; they sit above the items and
  // drift at their own depth while scrolling.
  // gullEvery: when set, every Nth piece is a larger gull (used on list pages).
  function sprinkle(list, name, seed, gullEvery) {
    if (!list || list.querySelector(":scope > .fx-over")) return;
    var r = seeded(seed);
    var count = Math.max(2, Math.round(list.offsetHeight / 320));
    var specs = [];
    for (var i = 0; i < count; i += 1) {
      var kind = OVERLAY_KINDS[(i * 4 + seed) % OVERLAY_KINDS.length];
      var label = "// " + name + " " + String(i + 1).padStart(2, "0");
      var made = kind(r, label);
      if (gullEvery && i % gullEvery === 0) {
        made = ["fx-gull", { s: Math.round(60 + r() * 30) + "px", tilt: Math.round(r() * 20 - 10) + "deg", flip: r() < 0.5 }];
      }
      var y = ((i + 0.25 + r() * 0.5) / count) * 100;
      var x = 16 + r() * 78;
      var depth = r() < 0.25 ? -(0.08 + r() * 0.12) : 0.15 + r() * 0.5;
      var extra = made[1] || {};
      specs.push([made[0] + (i % 2 ? " fx-hide-sm" : ""), x.toFixed(1) + "%", y.toFixed(1) + "%", depth.toFixed(2), extra]);
    }
    var field = fxField(specs);
    field.classList.add("fx-over");
    list.appendChild(field);
    registerLayers(field);
  }

  /* ---------------- Scroll: parallax + progress ---------------- */

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  var layers = [];

  function registerLayers(scope) {
    if (reduceMotion) return;
    scope.querySelectorAll("[data-depth]").forEach(function (el) {
      if (el._layer) return;
      el._layer = true;
      layers.push(el);
    });
    requestScrollUpdate();
  }

  function initScroll() {
    var nav = document.querySelector(".top-nav");
    var ticking = false;

    function measureNav() {
      root.style.setProperty("--nav-h", (nav ? nav.offsetHeight : 0) + "px");
    }

    // Each layer drifts by its depth as it travels: positive depth trails the
    // scroll (far away), negative depth leads it (close up). A layer sits at its
    // designed spot when it crosses the viewport centre, or at page load if it
    // is already above the centre then, so nothing near the top starts displaced.
    function updateParallax() {
      var mid = window.innerHeight / 2;
      var scrollY = window.scrollY;
      var moves = layers.map(function (el) {
        var rect = el.getBoundingClientRect();
        var centre = rect.top + rect.height / 2 - (el._py || 0);
        var rest = Math.min(centre + scrollY, mid);
        var depth = parseFloat(el.getAttribute("data-depth")) || 0;
        return clamp(-(centre - rest) * depth, -200, 200);
      });
      layers.forEach(function (el, i) {
        el._py = moves[i];
        el.style.translate = "0 " + moves[i].toFixed(1) + "px";
      });
    }

    function update() {
      ticking = false;
      var max = Math.max(1, root.scrollHeight - window.innerHeight);
      root.style.setProperty("--sp", clamp(window.scrollY / max, 0, 1).toFixed(4));
      // Photo-to-OC wipe completes over the first stretch of scrolling.
      root.style.setProperty("--swap", clamp(window.scrollY / Math.min(320, max * 0.6), 0, 1).toFixed(4));
      updateOc();
      checkReveals();
      if (layers.length) updateParallax();
    }

    function request() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    requestScrollUpdate = request;
    registerLayers(document);
    measureNav();
    update();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", function () {
      measureNav();
      request();
    });
  }

  function h(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      var value = attrs[key];
      if (value == null || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else node.setAttribute(key, value);
    });
    (children || []).forEach(function (child) {
      if (child == null || child === false) return;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  function catalogDir(catalogUrl) {
    return catalogUrl.replace(/[^/]+$/, "");
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("Failed to load " + url);
      return response.json();
    });
  }

  function loadItems(catalogUrl) {
    return fetchJson(catalogUrl).then(function (catalog) {
      var base = catalogDir(catalogUrl);
      var slugs = catalog.items || [];
      return Promise.all(
        slugs.map(function (slug) {
          var itemBase = base + slug + "/";
          return fetchJson(itemBase + "item.json").then(function (item) {
            item.slug = slug;
            item.basePath = itemBase;
            item.coverUrl = item.cover ? itemBase + item.cover : "";
            item.keywords = item.keywords || [];
            item.links = item.links || [];
            item.bullets = item.bullets || [];
            return item;
          });
        })
      );
    });
  }

  function typeLabel(type) {
    if (type === "research") return "Research";
    if (type === "internship") return "Internship";
    if (type === "awards") return "Awards";
    return type || "";
  }

  function headingTag(type) {
    return type === "research" ? "h3" : "h2";
  }

  function statusClass(kind) {
    if (kind === "accepted") return "status-badge status-accepted";
    if (kind === "under-review") return "status-badge status-under-review";
    if (kind === "preparing") return "status-badge status-preparing";
    return "status-badge";
  }

  function linkEls(links, className) {
    return (links || []).map(function (link) {
      return h(
        "a",
        {
          href: link.href,
          target: "_blank",
          rel: "noopener noreferrer",
          class: className || "",
        },
        [link.label]
      );
    });
  }

  function renderCard(item, index) {
    var title = h(headingTag(item.type), {}, [item.title]);
    var subtitle = item.subtitle ? h("p", { class: "post-subtitle" }, [item.subtitle]) : null;
    var pills =
      item.keywords.length > 0
        ? h(
            "div",
            { class: "keyword-pills" },
            item.keywords.map(function (keyword) {
              return h("span", { class: "keyword-pill" }, [keyword]);
            })
          )
        : null;
    var authors = item.authors ? h("p", { class: "post-author" }, [item.authors]) : null;
    var bullets =
      item.bullets.length > 0
        ? h("div", { class: "post-content" }, [
            h(
              "ul",
              {},
              item.bullets.map(function (bullet) {
                return h("li", {}, [bullet]);
              })
            ),
          ])
        : null;
    var actionsChildren = linkEls(item.links);
    if (item.status) {
      actionsChildren.push(h("span", { class: statusClass(item.statusKind) }, [item.status]));
    }
    var actions = actionsChildren.length ? h("div", { class: "post-actions" }, actionsChildren) : null;
    var thumb = item.coverUrl
      ? h("div", { class: "post-thumb" }, [
          h("div", { class: "post-thumb-frame" }, [
            h("img", {
              "data-lightbox": "",
              src: item.coverUrl,
              alt: item.title,
            }),
          ]),
        ])
      : null;

    var card = h("article", { class: "post-card", id: item.slug }, [
      h("div", { class: "post-body" }, [
        h("div", {}, [
          h("div", { class: "post-meta" }, [
            h("span", { class: "post-type" }, [typeLabel(item.type)]),
            item.date ? h("span", { class: "post-date" }, [item.date]) : null,
          ]),
          title,
          subtitle,
          pills,
        ]),
        authors,
        bullets,
        actions,
      ]),
      thumb,
    ]);
    card.style.animationDelay = index * 50 + "ms";
    if (item.keywords.length) card.setAttribute("data-keywords", item.keywords.join("|"));
    return card;
  }

  function publicationVenue(item) {
    if (item.type !== "research" || !item.status) return "";
    return item.status.replace(/\s*:\s*(Accepted|Under Review|Preparing)\s*$/i, "");
  }

  function renderHomeItem(item, sectionHref) {
    var title = sectionHref
      ? h("h4", {}, [h("a", { href: sectionHref + "#" + item.slug }, [item.title])])
      : h("h4", {}, [item.title]);
    var venue = publicationVenue(item);
    var links =
      item.type === "internship"
        ? null
        : item.links.length
          ? h("div", { class: "home-links" }, linkEls(item.links))
          : null;
    return h("article", { class: "home-item" }, [
      h("div", { class: "home-item-head" }, [
        title,
        item.date ? h("span", { class: "home-date" }, [item.date]) : null,
      ]),
      item.type === "internship" && item.subtitle
        ? h("p", { class: "home-subtitle" }, [item.subtitle])
        : null,
      item.type !== "internship" && item.authors
        ? h("p", { class: "home-author" }, [item.authors])
        : null,
      venue ? h("p", { class: "home-venue" }, [venue]) : null,
      links,
    ]);
  }

  function setStatus(container, message) {
    container.replaceChildren(h("p", { class: "list-status" }, [message]));
  }

  function uniqueKeywords(items) {
    var seen = {};
    var list = [];
    items.forEach(function (item) {
      item.keywords.forEach(function (keyword) {
        if (!seen[keyword]) {
          seen[keyword] = true;
          list.push(keyword);
        }
      });
    });
    return list;
  }

  function bindFilters(itemsRoot, chipsRoot, countEl) {
    var selected = {};
    var cleanBtn = chipsRoot.querySelector('[data-keyword="__clean"]');

    function selectedList() {
      return Object.keys(selected).filter(function (key) {
        return selected[key];
      });
    }

    function applyFilter() {
      var active = selectedList();
      var cards = itemsRoot.querySelectorAll(".post-card[data-keywords]");
      var visible = 0;
      cards.forEach(function (card) {
        var keywords = (card.getAttribute("data-keywords") || "")
          .split("|")
          .map(function (item) {
            return item.trim();
          })
          .filter(Boolean);
        var show =
          active.length === 0 ||
          keywords.some(function (keyword) {
            return selected[keyword];
          });
        card.classList.toggle("hidden", !show);
        if (show) visible += 1;
      });
      if (countEl) {
        countEl.hidden = active.length === 0;
        countEl.textContent = visible + " results";
      }
      if (cleanBtn) cleanBtn.hidden = active.length === 0;
      requestScrollUpdate();
    }

    chipsRoot.addEventListener("click", function (event) {
      var chip = event.target.closest("[data-keyword]");
      if (!chip) return;
      var keyword = chip.getAttribute("data-keyword");
      if (keyword === "__clean") {
        selected = {};
        chipsRoot.querySelectorAll("[data-keyword]").forEach(function (item) {
          item.classList.remove("active");
        });
      } else if (selected[keyword]) {
        delete selected[keyword];
        chip.classList.remove("active");
      } else {
        selected[keyword] = true;
        chip.classList.add("active");
      }
      applyFilter();
    });
  }

  function renderFilterChips(chipsRoot, keywords) {
    chipsRoot.replaceChildren();
    keywords.forEach(function (keyword) {
      chipsRoot.appendChild(
        h("button", { class: "filter-chip", type: "button", "data-keyword": keyword }, [keyword])
      );
    });
    chipsRoot.appendChild(
      h(
        "button",
        { class: "filter-chip clean", type: "button", "data-keyword": "__clean", hidden: "" },
        ["Clean"]
      )
    );
  }

  function scrollToHash() {
    var id = decodeURIComponent((location.hash || "").replace(/^#/, ""));
    if (!id) return;
    var target = document.getElementById(id);
    if (target) target.scrollIntoView({ block: "start" });
  }

  function renderListPage() {
    var catalogUrl = document.body.getAttribute("data-catalog");
    if (!catalogUrl) return;
    var listRoot = document.querySelector("[data-item-list]");
    if (!listRoot) return;
    setStatus(listRoot, "Loading…");
    loadItems(catalogUrl)
      .then(function (items) {
        listRoot.replaceChildren();
        items.forEach(function (item, index) {
          var card = renderCard(item, index);
          listRoot.appendChild(card);
          reveal(card);
        });
        var filterBar = document.querySelector("[data-filter-bar]");
        var chipsRoot = filterBar && filterBar.querySelector(".filter-chips");
        var keywords = uniqueKeywords(items);
        if (filterBar && chipsRoot && keywords.length) {
          filterBar.hidden = false;
          renderFilterChips(chipsRoot, keywords);
          bindFilters(listRoot, chipsRoot, document.getElementById("filter-count"));
        }
        var pageName = (document.querySelector(".page-intro h2") || {}).textContent || "LOG";
        sprinkle(listRoot, pageName.trim().toUpperCase().slice(0, 3), pageName.length + 11, 3);
        scrollToHash();
      })
      .catch(function () {
        setStatus(listRoot, "Unable to load items.");
      });
  }

  function renderHome() {
    var sections = document.querySelectorAll("[data-home-catalog]");
    sections.forEach(function (section, sectionIndex) {
      var listRoot = section.querySelector(".home-list");
      if (!listRoot) return;
      setStatus(listRoot, "Loading…");
      var href = section.getAttribute("data-home-href") || "";
      loadItems(section.getAttribute("data-home-catalog"))
        .then(function (items) {
          var visible = items.filter(function (item) {
            return item.type !== "research" || item.statusKind === "accepted";
          });
          listRoot.replaceChildren();
          visible.forEach(function (item) {
            listRoot.appendChild(renderHomeItem(item, href));
          });
          reveal(listRoot);
          var heading = section.querySelector("h3");
          sprinkle(listRoot, heading ? heading.textContent.trim().toUpperCase().slice(0, 3) : "ITM", sectionIndex + 3);
        })
        .catch(function () {
          setStatus(listRoot, "Unable to load items.");
        });
    });
  }

  function bindLightbox() {
    var modal = document.getElementById("image-modal");
    var modalImg = document.getElementById("image-modal-img");

    function openModal(src, alt) {
      if (!modal || !modalImg) return;
      modalImg.src = src;
      modalImg.alt = alt || "";
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
    }

    function closeModal() {
      if (!modal || !modalImg) return;
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      window.setTimeout(function () {
        if (!modal.classList.contains("open")) {
          modalImg.removeAttribute("src");
          modalImg.alt = "";
        }
      }, 300);
    }

    document.addEventListener("click", function (event) {
      var img = event.target.closest("[data-lightbox]");
      if (img) openModal(img.getAttribute("src"), img.getAttribute("alt"));
    });

    if (modal) {
      modal.addEventListener("click", function (event) {
        if (event.target === modal) closeModal();
      });
      var closeBtn = modal.querySelector(".modal-close");
      if (closeBtn) closeBtn.addEventListener("click", closeModal);
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeModal();
    });
  }

  initDecor();
  initScroll();
  bindLightbox();
  renderHome();
  renderListPage();
})();
