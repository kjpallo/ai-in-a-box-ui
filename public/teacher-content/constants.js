(() => {
  const ns = (window.CharlemagneTeacherContent = window.CharlemagneTeacherContent || {});

  const ENDPOINTS = {
    dashboard: '/api/teacher-content/dashboard',
    uploadExtract: '/api/teacher-content/uploads/extract',
    uploadAndPrepare: '/api/teacher-content/uploads/upload-and-prepare',
    uploadPrepareReview: (uploadId) => `/api/teacher-content/uploads/${encodeURIComponent(uploadId)}/prepare-review`,
    uploadHistory: '/api/teacher-content/uploads/history',
    drafts: '/api/teacher-content/drafts',
    draftReport: (packId, standardsBankId = '') => {
      const query = standardsBankId ? `?standardsBankId=${encodeURIComponent(standardsBankId)}` : '';
      return `/api/teacher-content/drafts/${encodeURIComponent(packId)}/report${query}`;
    },
    standardsBanks: '/api/teacher-content/standards-banks',
    standardsBank: (standardsBankId) => `/api/teacher-content/standards-banks/${encodeURIComponent(standardsBankId)}`,
    promoteDraft: (packId) => `/api/teacher-content/drafts/${encodeURIComponent(packId)}/promote`,
    approveCombinedReview: '/api/teacher-content/review/approve-combined',
    acceptedDraftCopy: (packId) => `/api/teacher-content/drafts/${encodeURIComponent(packId)}/accepted-copy`,
    draftReviewQueue: (packId) => `/api/teacher-content/drafts/${encodeURIComponent(packId)}/review-queue`,
    draftItem: (packId, section, index) => `/api/teacher-content/drafts/${encodeURIComponent(packId)}/items/${encodeURIComponent(section)}/${encodeURIComponent(index)}`,
    draftItemStatus: (packId, section, index) => `/api/teacher-content/drafts/${encodeURIComponent(packId)}/items/${encodeURIComponent(section)}/${encodeURIComponent(index)}/status`,
    approved: '/api/teacher-content/approved',
    approvedPack: (packId) => `/api/teacher-content/approved/${encodeURIComponent(packId)}`,
    approvedItem: (packId, section, index) => `/api/teacher-content/approved/${encodeURIComponent(packId)}/items/${encodeURIComponent(section)}/${encodeURIComponent(index)}`,
    approvedActivation: (packId) => `/api/teacher-content/approved/${encodeURIComponent(packId)}/activation`,
    approvedDelete: (packId) => `/api/teacher-content/approved/${encodeURIComponent(packId)}`,
    approvedBulkDelete: '/api/teacher-content/approved'
  };

  const TABS = [
    { id: 'upload', label: 'Upload', shortLabel: 'Upload' },
    { id: 'review', label: 'Review', shortLabel: 'Review' }
  ];

  const SECTION_LABELS = {
    vocabulary: 'Vocabulary',
    concepts: 'Concept',
    referenceFormulas: 'Formula',
    problemBank: 'Problem',
    examples: 'Examples',
    misconceptions: 'Misconceptions',
    standardsMap: 'Standard suggestion',
    smokeTests: 'Warning'
  };

  const REVIEW_GROUP_ORDER = [
    'vocabulary',
    'concepts',
    'referenceFormulas',
    'problemBank',
    'examples',
    'misconceptions',
    'standardsMap',
    'smokeTests'
  ];

  const REVIEW_COUNTED_SECTIONS = [
    'vocabulary',
    'concepts',
    'referenceFormulas',
    'problemBank',
    'standardsMap',
    'smokeTests'
  ];

  const REVIEW_PRIMARY_DRAFT_SECTIONS = [
    'vocabulary',
    'concepts',
    'referenceFormulas',
    'problemBank',
    'standardsMap',
    'smokeTests'
  ];

  const IMPORT_PROFILES = [
    { value: 'general', label: 'General' },
    { value: 'physical_science', label: 'Science' },
    { value: 'math', label: 'Math' },
    { value: 'english_reading', label: 'English / Reading' },
    { value: 'history_social_studies', label: 'History / Social Studies' },
    { value: 'art', label: 'Art' },
    { value: 'computer_science', label: 'Computer Science' },
    { value: 'robotics', label: 'Robotics' },
    { value: 'procedures_class_info', label: 'Class Info / Procedures' }
  ];

  const EDITABLE_FIELDS = {
    vocabulary: ['term', 'studentDefinition', 'teacherDefinition', 'misconception', 'sourceFile', 'sourceLocation', 'sourceTextSnippet'],
    concepts: ['conceptId', 'title', 'studentExplanation', 'keyIdeas', 'sourceFile', 'sourceLocation', 'sourceTextSnippet'],
    referenceFormulas: ['title', 'equation', 'sourceFile', 'sourceLocation', 'sourceTextSnippet'],
    problemBank: ['question', 'expectedAnswer', 'sourceFile', 'sourceLocation', 'sourceTextSnippet'],
    standardsMap: ['standardId', 'description'],
    smokeTests: ['question', 'expectedAnswer', 'expectedRoute']
  };

  const IMPORT_ACTIVITY_MESSAGES = {
    uploadReceived: 'Upload received',
    extractingText: 'Extracting text',
    wrapper: 'Building draft packet wrapper',
    gemmaDraft: 'Creating review draft with Gemma',
    validation: 'Running validation',
    draftReady: 'Draft ready for review'
  };

  const PAUSED_STANDARDS_WARNING_PATTERNS = [
    /standardsmap is empty/i,
    /smoketests is empty/i
  ];

  ns.constants = {
    ENDPOINTS,
    TABS,
    SECTION_LABELS,
    REVIEW_GROUP_ORDER,
    REVIEW_COUNTED_SECTIONS,
    REVIEW_PRIMARY_DRAFT_SECTIONS,
    IMPORT_PROFILES,
    EDITABLE_FIELDS,
    IMPORT_ACTIVITY_MESSAGES,
    PAUSED_STANDARDS_WARNING_PATTERNS
  };
})();
