// Instructions guide real controls; advancing a step never claims task completion.
export const WALKTHROUGHS = {
  create: {
    title: 'Create and improve an app',
    steps: [
      { title: 'Try the app you just built', text: 'Watch the build finish, then open Preview and choose Carryover leave. Read the answer and its source.', action: 'Open Preview', tab: 'preview' },
      { title: 'Connect the answer to its agent', text: 'Turn on Select, then click the answer card. Change Answer length to Detailed and see the answer update. Follow Handbook assistant to inspect the agent behind the answer.', action: 'Select in Preview', tab: 'preview', select: true },
      { title: 'Make a change you can review', text: 'Ask “make the answers shorter and use a dark mode”. Open a changed-file chip to inspect the diff. Version history lets you restore the previous version.', action: 'Open chat', chat: true },
      { title: 'Publish a version you can return to', text: 'Open Publish, review the checks and publish. Open the demo release in this browser. Its snapshot stays separate from later draft edits.', action: 'Open Publish', publish: true },
    ],
  },
  developer: {
    title: 'Continue an existing project',
    steps: [
      { title: 'Understand the imported project', text: 'In Code, choose Start app. Add both missing variable names when prompted; setup reruns after each. These are setup examples; no real keys are needed.', action: 'Open Code', tab: 'code' },
      { title: 'Make a change and catch a failure', text: 'Edit data/example-handbook.txt to “Working hours: Core hours are 10 to 3.” Save, then Run tests. Two sample-answer checks should fail.', action: 'Open the data file', tab: 'code', file: true },
      { title: 'Review a repair', text: 'Choose Fix with Architect in Code. In chat, accept the proposed handbook restore and inspect the passing checks. Then ask “add feedback buttons to answers”.', action: 'Open Code', tab: 'code' },
      { title: 'Review, merge and publish', text: 'Open Publish → Open PR. Inspect the diff and checks, create the demo PR and merge it. Publish the release, or Download runnable source in Code.', action: 'Open Publish', publish: true },
    ],
  },
};
