# ADAX
### The power of simplicity.
ADAX mini-library (less than 2K gzipped) is the first step in an effort to dramatically streamline apps' **developement** and **maintenance** by simplifying their logic flow.

It is usually very easy to implement and reason about a single web component life cycle.
Complexity rises when your app grows. Indeed, The more you code, the more it becomes harder to understand how everything fits together.

ADAX is committed to keeping your app as easy to maintain and reason about as it is with a simple web component!

ADAX is so simple there is hardly anything to learn.
No external dependencies, no complicated patterns to adopt nor boiler plate code to write.

You may even chose to only use plain old _JavaScript_ (or _TypeScript_) **from start to finish**.
ADAX only helps you adhere to simplicity!

ADAX does not force you to throw your old code. You can start using ADAX gradually in already existing apps (<sub><sup>either adopting ADAX completely or only partially</sup></sub>).

React | Vue | Angular | Svelte | Solid | Vanilla JS
:-------------------------:|:-------------------------:|:-------------------------:|:-------------------------:|:-------------------------:|:-------------------------:
[![adax-react](assets/react.svg)](https://github.com/MirjamElad/adax-react)  | [![adax-vue](assets/vue.svg)](https://github.com/MirjamElad/adax-vue) |  [![adax-angular](assets/angular.svg)](https://github.com/MirjamElad/adax-angular)  | ![Nextra icon](assets/svelte.svg)  |  ![Nextra icon](assets/solid.svg)  |  [![adax-core](assets/vanilla.svg)](https://github.com/MirjamElad/adax-core)  

Not only is ADAX designed to be used by any front end library/framework but it also facilitates using different libraries in the same app. ADAX allows all parts/libraries of your app to fully _access_ the same state and _react_ to its changes.
[See an example with all of React, Vue and Vanilla javascript here](https://github.com/MirjamElad/ADAX-Vanilla-Vue-React) 

<sub>(**NB**: _**[adax-core](https://github.com/MirjamElad/adax-core)**_ can be used with vanilla javascript or any library/framework. However, it is more convenient to use an adapter of your favorite library. We released _**[adax-react](https://github.com/MirjamElad/adax-react)**_ whereas _**adax-vue**_ and _**adax-angular**_ are being tested. More adapters coming soon)</sub>


#### Overview

Here's a _Typical_ scenario showing one of the ways ADAX can be used. 

<br /><center><Image src="/assets/ADAX-Figure-1.png" alt="Sample setup" width={300} height={300} /></center>

One can start by defining the:

* **State**: much like you define the local data/state of a single web component. You define the data/state for the full application or just a subset of it.
_Organize your state in any way you want. Per component, per group of components or the full app. Place it in a single store, multiple stores, in JSON file(s) ...etc._ 

* **Query**: (read) functions to reactively listen to the state changes. _Views and components need to subscribe to the data portions they are interested in. For maximum flexibility, they **subcribe to queries** rather then to predetermined objects_.

* **Mutate**: (create, update, delete) functions to change the state. _Views and components can alter the app's data/state through functions as a result of user actions, server interactions, ...etc_.

> As always, you can use regular and simple JavaScript/TypeScript to implement **Query** and **Mutate** functions. All such functions can be used in both visual and non-visual "components".

* **Rules**(Optional): are ADAX's thin layer to allow the app to _listen_ to the state and _react_ to its changes. _I.e. Rules for which query functions must re-run due to which mutate functions and under what conditions_.

ADAX has a tiny API surface: **trigger** and **useSync** to wrap mutate & query functions respectively (Both shown as dashed arrows in the figure above. Red color is used for **trigger** and blue for **useSync**). The third function is **addRule** to customize when/if reactivity happens.


Documentation for ADAX and the imeplented adapters is being worked on.
However, most developers should be able to understand adax by just checking the provided simple example (it uses adax-react).
You can play with this example's code [here on stackblitz](https://stackblitz.com/~/github.com/MirjamElad/Adax-React-TW-Exp_0) (It comes with a shorter explanation of ADAX). 

<sub>There are a number of ways to control when/if reactivity happens (views re-rendered and side-effects fired). We encourage the use of Rules as done in the simple example above. Documentation and code examples about the other options to come later.</sub>