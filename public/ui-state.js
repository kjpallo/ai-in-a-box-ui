(() => {
  const initialState = {
    mode: 'teacher',
    activeBlade: 'main',
    isSpeaking: false,
    isListening: false,
    isRecording: false,
    isThinking: false,
    studentModeLocked: false,
    lastQuestion: null,
    lastAnswer: null
  };

  const state = window.CharlemagneState || { ...initialState };
  const listeners = new Set();

  function setState(partialState = {}) {
    if (!partialState || typeof partialState !== 'object') return getState();

    Object.assign(state, partialState);
    listeners.forEach((listener) => {
      try {
        listener(getState());
      } catch (error) {
        console.warn('Charlemagne state listener failed:', error);
      }
    });

    return getState();
  }

  function getState() {
    return { ...state };
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  window.CharlemagneState = state;
  window.Charlemagne = window.Charlemagne || {};
  window.Charlemagne.state = {
    current: state,
    get: getState,
    set: setState,
    subscribe
  };
})();
