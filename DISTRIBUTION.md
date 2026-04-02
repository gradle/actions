# Distribution and Licensing of gradle/actions

This document provides a clear breakdown of the components within the `gradle/actions` repository, their respective licenses, and how we handle data and privacy. Our goal is to provide the best possible experience for running Gradle on GitHub Actions while maintaining our commitment to the open-source community.

## 1. Component Map
The `gradle/actions` project consists of three primary components:

| Component | License | Source | Description |
| :--- | :--- | :--- | :--- |
| **Action Runner** | **[MIT](LICENSE)** | Open | The core action logic: configures a local Gradle installation, performs wrapper validation, and reports on Gradle build execution. |
| **Basic Caching** | **[MIT](LICENSE)** | Open | Configures basic Gradle User Home caching using 'actions/cache'. |
| **Enhanced Caching** | **[Proprietary](NOTICE)** | Closed | Uses the 'gradle-actions-caching' library to provide fine-grained caching of Gradle User Home, intelligent cache cleanup and other advanced features. |

By default, **Enhanced Caching** is enabled to provide the best experience.

## 2. The "Safe Harbor" Clause (Data Privacy)
The proprietary components of this action are governed by the **[Gradle Technologies Terms of Use](https://gradle.com/legal/gradle-technologies-terms-of-use/)**. We have updated these terms to include a specific safe harbor for users of `gradle-actions-caching`.

> **Plain English Summary:** Gradle does not claim ownership of any code, build artifacts, or other content processed by the caching library. These remain your sole property. We only use metadata (like cache keys) to facilitate the caching service.

## 3. Usage Tiers
To support the development of high-performance CI tooling, we offer the following usage model:

* **Public Repositories:** 
    * Both **Basic** and **Enhanced** caching are free forever. We are committed to supporting the open-source ecosystem at no cost.
* **Private Repositories:** 
    * **Basic Caching** is free forever under the MIT license.
    * **Enhanced Caching** is currently in a **Free Preview** phase. We plan to introduce usage-based tiers for large-scale commercial organizations in the future.

## 4. Your Choice: Basic vs. Enhanced
We believe in user autonomy. If you do not wish to use proprietary code or accept the Gradle Technologies Terms of Use, you can opt-out of enhanced caching with a single line of configuration:

```yaml
- uses: gradle/actions/setup-gradle@v6
  with:
    cache-provider: basic # Switches to the MIT-licensed open-source implementation
```

> [!IMPORTANT]
> ## Licensing notice
>
> The software in this repository, except for the bundled `gradle-actions-caching` component, is licensed under the [MIT License](LICENSE).
>
> The caching functionality in this project has been extracted into `gradle-actions-caching`, a proprietary commercial component that is not covered by the MIT License for this repository. 
>
> Use of the `gradle-actions-caching` component is subject to a separate license, available at https://gradle.com/legal/terms-of-use/.
> 
> The `gradle-actions-caching` component is used only when enhanced caching is enabled and is not loaded or used with basic caching or when caching is disabled.
