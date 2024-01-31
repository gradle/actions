<img width="1102" alt="image" src="https://github.com/gradle/actions/assets/179734/d5922f72-852e-408a-b5c7-b0aeb6437566"># The `dependency-submission` action

The `gradle/actions/dependency-submission` action provides the simplest (and recommended) way to generate a 
dependency graph for your project. This action will attempt to detect all dependencies used by your build
without building and testing the project itself.

The dependency graph snapshot is generated via integration with the [GitHub Dependency Graph Gradle Plugin](https://plugins.gradle.org/plugin/org.gradle.github-dependency-graph-gradle-plugin), and submitted to your repository via the 
[GitHub Dependency Submission API](https://docs.github.com/en/rest/dependency-graph/dependency-submission).
The generated snapshot files can be submitted in the same job, or saved for submission in a subsequent job.

The generated dependency graph includes all of the dependencies in your build, and is used by GitHub to generate 
[Dependabot Alerts](https://docs.github.com/en/code-security/dependabot/dependabot-alerts/about-dependabot-alerts) 
for vulnerable dependencies, as well as to populate the 
[Dependency Graph insights view](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/exploring-the-dependencies-of-a-repository#viewing-the-dependency-graph).

## General usage

The following workflow will generate a dependency graph for a Gradle project and submit it immediately to the repository via the
Dependency Submission API. For most projects, this default configuration should be all that you need.

Simply add this as a new workflow file to your repository (eg `.github/workflows/dependency-submission.yml`).

```yaml
name: Dependency Submission

on: [ push ]

permissions:
  contents: write

jobs:
  dependency-submission:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout sources
      uses: actions/checkout@v4
    - name: Generate and submit dependency graph
      uses: gradle/actions/dependency-submission@v3
```

### Configuration parameters

In some cases, the default action configuration will not be sufficient, and additional action parameters will need to be specified.

See the example below for a summary, and the [Action Metadata file](action.yml) for a more detailed description of each input parameter.

```yaml
name: Dependency Submission with advanced config

on: [ push ]

permissions:
  contents: read

jobs:
  dependency-submission:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout sources
      uses: actions/checkout@v4
    - name: Generate and save dependency graph
      uses: gradle/actions/dependency-submission@v3
      with:
        # Use a particular Gradle version instead of the configured wrapper.
        gradle-version: 8.6-rc-2

        # The gradle project is not in the root of the repository.
        build-root-directory: my-gradle-project

        # Enable configuration-cache reuse for this build.
        cache-encryption-key: ${{ secrets.GRADLE_ENCRYPTION_KEY }}

        # Do not attempt to submit the dependency-graph. Save it as a workflow artifact.
        dependency-graph: generate-and-upload
```

## Finding the source of a dependency vulnerability

Once you have submitted a dependency graph, you may receive Dependabot Alerts warning about vulnerabilities in
dependencies of your project. In the case of transitive dependencies, it may not be obvious how that dependency is
used or what you can do to address the vulnerability alert.

The first step to investigating a Dependabot Alert is to determine the source of the dependency. One of the best ways to 
do so is with a free Gradle Develocity Build Scan®, which makes it easy to explore the dependencies resolved in your build.

<img width="1069" alt="image" src="https://github.com/gradle/actions/assets/179734/3a637dfd-396c-4e94-8332-dcc6eb5a35ac">

In this example, we are searching for dependencies matching the name 'com.squareup.okio:okio' in the _Build Dependencies_ of 
the project. You can easily see that this dependency originates from 'com.github.ben-manes:gradle-versions-plugin'.
Knowing the source of the dependency can help determine how to deal with the Dependabot Alert.

Note that you may need to look at both the _Dependencies_ and the _Build Dependencies_ of your project to find the
offending dependency.

### When you cannot use Build Scans

If publishing a free Build Scan to https://scans.gradle.com isn't an option, and you don't have access to a private [Develocity
server](https://gradle.com/) for your project, you can use the GitHub Dependency Graph Gradle Plugin to generate a report 
listing the dependencies resolved in your build.

## Limiting the scope of the dependency graph

By default, the `dependency-submission` action attempts to detect all dependencies declared and used by your Gradle build.
At times it may helpful to limit the dependencies reported to GitHub, to avoid security alerts for dependencies that 
don't form a critical part of your product. For example, a vulnerability in the tool you use to generate documentation 
may not be as important as a vulnerability in one of your runtime dependencies.

The `dependency-submission` action provides a convenient mechanism to filter the projects and configurations that
contribute to the dependency graph.

> [!NOTE]
> Ideally, all dependencies involved in building and testing a project will be extracted and reported in a dependency graph. 
> These dependencies would be assigned to different scopes (eg development, runtime, testing) and the GitHub UI would make it easy to opt-in to security alerts for different dependency scopes.
> However, this functionality does not yet exist.

### Excluding certain Gradle projects from to the dependency graph

If you do not want the dependency graph to include dependencies from every project in your build, 
you can easily exclude certain projects from the dependency extraction process.

To restrict which Gradle subprojects contribute to the report, specify which projects to exclude via a regular expression.
You can provide this value via the `DEPENDENCY_GRAPH_EXCLUDE_PROJECTS` environment variable or system property.

Note that excluding a project in this way only removes dependencies that are _resolved_ as part of that project, and may
not necessarily remove all dependencies _declared_ in that project. If another project depends on the excluded project
then it may transitively resolve dependencies declared in the excluded project: these dependencies will still be included
in the generated dependency graph.

### Excluding certain Gradle configurations from to the dependency graph

Similarly to Gradle projects, it is possible to exclude a set of configuration instances from dependency graph generation,
so that dependencies resolved by those configurations are not included.

To restrict which Gradle configurations contribute to the report, specify which configurations to exclude via a regular expression.
You can provide this value via the `DEPENDENCY_GRAPH_EXCLUDE_CONFIGURATIONS` environment variable or system property.

Note that configuration exclusion applies to the configuration in which the dependency is _resolved_ which is not necessarily
the configuration where the dependency is _declared_. For example if you decare a dependency as `implementation` in
a Java project, that dependency will be resolved in `compileClasspath`, `runtimeClasspath` and possibly other configurations.

### Example of project and configuration filtering

For example, if you want to exclude dependencies in the `buildSrc` project, and exclude dependencies from the `testCompileClasspath` and `testRuntimeClasspath` configurations, you would use the following configuration:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout sources
      uses: actions/checkout@v4
    - name: Generate and submit dependency graph
      uses: gradle/actions/dependency-submission@v3
      env:
        DEPENDENCY_GRAPH_EXCLUDE_PROJECTS: ':buildSrc'
        DEPENDENCY_GRAPH_EXCLUDE_CONFIGURATIONS: 'test(Compile|Runtime)Classpath'
```

### Other configuration options

The [GitHub Dependency Graph Gradle Plugin](https://plugins.gradle.org/plugin/org.gradle.github-dependency-graph-gradle-plugin)
has other filtering options that may be useful.
 See [the docs](https://github.com/gradle/github-dependency-graph-gradle-plugin?tab=readme-ov-file#filtering-which-gradle-configurations-contribute-to-the-dependency-graph) for details.

## Advance usage scenarios

### Using a custom plugin repository

By default, the action downloads the `github-dependency-graph-gradle-plugin` from the Gradle Plugin Portal (https://plugins.gradle.org). If your GitHub Actions environment does not have access to this URL, you can specify a custom plugin repository to use. 
Do so by setting the `GRADLE_PLUGIN_REPOSITORY_URL` environment variable.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout sources
      uses: actions/checkout@v4
    - name: Generate and submit dependency graph
      uses: gradle/actions/dependency-submission@v3
      env:
        GRADLE_PLUGIN_REPOSITORY_URL: "https://gradle-plugins-proxy.mycorp.com"
```

### Integrating the `dependency-review-action`

The GitHub [dependency-review-action](https://github.com/actions/dependency-review-action) helps you 
understand dependency changes (and the security impact of these changes) for a pull request,
by comparing the dependency graph for the pull-request with that of the HEAD commit.

Example of a pull request workflow that executes a build for a pull request and runs the `dependency-review-action`:

```yaml
name: Dependency review for pull requests

on: [ pull_request ]

permissions:
  contents: write

jobs:
  dependency-submission:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout sources
      uses: actions/checkout@v4
    - name: Generate and submit dependency graph
      uses: gradle/actions/dependency-submission@v3
  
  dependency-review:
    needs: dependency-submission
    runs-on: ubuntu-latest
    steps:
    - name: Perform dependency review
      uses: actions/dependency-review-action@v3
```

Note that the `dependency-submission` action submits the dependency graph at the completion of the workflow Job.
For this reason, the `dependency-review-action` must be executed in a dependent job, and not as a subsequent step in the job that generates the dependency graph.

### Usage with pull requests from public forked repositories

This `contents: write` permission is [not available for any workflow that is triggered by a pull request submitted from a public forked repository](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token).
This limitation is designed to prevent a malicious pull request from effecting repository changes.

Because of this restriction, we require 2 separate workflows in order to generate and submit a dependency graph:
1. The first workflow runs directly against the pull request sources and will `generate-and-upload` the dependency graph.
2. The second workflow is triggered on `workflow_run` of the first workflow, and will `download-and-submit` the previously saved dependency graph.

***Main workflow file***
```yaml
name: Generate and save dependency graph

on: [ pull_request ]

permissions:
  contents: read # 'write' permission is not available

jobs:
  dependency-submission:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout sources
      uses: actions/checkout@v4
    - name: Generate and save dependency graph
      uses: gradle/actions/dependency-submission@v3
      with:
        dependency-graph: generate-and-upload
```

***Dependent workflow file***
```yaml
name: Download and submit dependency graph

on:
  workflow_run:
    workflows: ['Generate and save dependency graph']
    types: [completed]

permissions:
  contents: write

jobs:
  submit-dependency-graph:
    runs-on: ubuntu-latest
    steps:
    - name: Download and submit dependency graph
      uses: gradle/actions/dependency-submission@v3
      with:
        dependency-graph: download-and-submit # Download saved dependency-graph and submit
```

### Integrating `dependency-review-action` for pull requests from public forked repositories

To integrate the `dependency-review-action` into the pull request workflows above, a third workflow file is required.
This workflow will be triggered directly on `pull_request`, but will wait until the dependency graph results are
submitted before the dependency review can complete. The period to wait is controlled by the `retry-on-snapshot-warnings` input parameters.

Here's an example of a separate "Dependency Review" workflow that will wait for 10 minutes for the above PR check workflow to complete.

```yaml
name: dependency-review

on: [ pull_request ]

permissions:
  contents: read

jobs:
  dependency-review:
    runs-on: ubuntu-latest
    steps:
    - name: 'Dependency Review'
      uses: actions/dependency-review-action@v3
      with:
        retry-on-snapshot-warnings: true
        retry-on-snapshot-warnings-timeout: 600
```

The `retry-on-snapshot-warnings-timeout` (in seconds) needs to be long enough to allow the entire `Generate and save dependency graph` and `Download and submit dependency graph` workflows (above) to complete.

## Gradle version compatibility

Dependency-graph generation is compatible with most versions of Gradle >= `5.2`, and is tested regularly against 
Gradle versions `5.2.1`, `5.6.4`, `6.0.1`, `6.9.4`, `7.1.1` and `7.6.3`, as well as all patched versions of Gradle 8.x.

A known exception to this is that Gradle `7.0`, `7.0.1` and `7.0.2` are not supported.

See [here](https://github.com/gradle/github-dependency-graph-gradle-plugin?tab=readme-ov-file#gradle-compatibility) for complete compatibility information.
