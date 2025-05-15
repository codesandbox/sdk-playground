import { CodeSandbox } from "@codesandbox/sdk";

const sdk = new CodeSandbox(process.env.CSB_API_TOKEN);

async function main() {
  console.log("Cloning repo");

  const sandbox = await sdk.sandbox.create({
    source: "git",
    url: "https://github.com/codesandbox/sdk-playground.git",
    branch: "main",
  });

  // const sandbox = await sdk.sandbox.resume("v3jyp3");
  console.log("Connecting", sandbox.id);
  const session = await sandbox.connect({
    id: "just-me",
    permission: "write",
    git: {
      accessToken: process.env.GITHUB_TOKEN,
      email: "christianalfoni@gmail.com",
      name: "Christian Alfoni",
    },
  });
  console.log("Writing file");
  await session.fs.writeTextFile("README.md", "Hello there");
  console.log("Checking out");
  await session.commands.run("git checkout -b test-branch");
  console.log("Status");
  console.log(await session.git.status());
  console.log("Commit and push");
  const output = await session.commands.run([
    "git add README.md",
    'git commit -m "test-commit"',
    "git push --set-upstream origin test-branch",
  ]);
  console.log("DONE!", output);
}

main();
