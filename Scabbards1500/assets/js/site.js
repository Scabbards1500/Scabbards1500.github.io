(function () {
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

  function renderHomeItem(item, sectionHref) {
    var title = sectionHref
      ? h("h4", {}, [h("a", { href: sectionHref + "#" + item.slug }, [item.title])])
      : h("h4", {}, [item.title]);
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
      item.type === "research" && item.status
        ? h("p", { class: "home-status" }, [
            h("strong", {}, ["Status:"]),
            " " + item.status,
          ])
        : null,
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
          listRoot.appendChild(renderCard(item, index));
        });
        var filterBar = document.querySelector("[data-filter-bar]");
        var chipsRoot = filterBar && filterBar.querySelector(".filter-chips");
        var keywords = uniqueKeywords(items);
        if (filterBar && chipsRoot && keywords.length) {
          filterBar.hidden = false;
          renderFilterChips(chipsRoot, keywords);
          bindFilters(listRoot, chipsRoot, document.getElementById("filter-count"));
        }
        scrollToHash();
      })
      .catch(function () {
        setStatus(listRoot, "Unable to load items.");
      });
  }

  function renderHome() {
    var sections = document.querySelectorAll("[data-home-catalog]");
    sections.forEach(function (section) {
      var listRoot = section.querySelector(".home-list");
      if (!listRoot) return;
      setStatus(listRoot, "Loading…");
      var href = section.getAttribute("data-home-href") || "";
      loadItems(section.getAttribute("data-home-catalog"))
        .then(function (items) {
          listRoot.replaceChildren();
          items.forEach(function (item) {
            listRoot.appendChild(renderHomeItem(item, href));
          });
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

  bindLightbox();
  renderHome();
  renderListPage();
})();
