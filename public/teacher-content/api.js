(() => {
  const ns = (window.CharlemagneTeacherContent = window.CharlemagneTeacherContent || {});

  async function fetchJson(url, options) {
    return window.Charlemagne.api.fetchJson(url, options);
  }

  ns.api = {
    fetchJson
  };
})();
