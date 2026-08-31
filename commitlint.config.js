module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 커밋 메시지 본문은 한국어로 작성하므로 대소문자 규칙은 적용하지 않는다
    'subject-case': [0],
  },
};
