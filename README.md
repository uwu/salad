# Salad: SFCs for SolidJS
Salad is an SFC compiler for SolidJS inspired heavily by Vue 3's single-file-components.

While Salad does not aim for 1:1 compatibility with Vue's SFC format, it is similar enough to be familiar for most Vue devs. If you are looking for compatibility with Vue SFCs, I would highly suggest waiting for Vue Vapor, Vue's upcoming compiler that works very similarly to SolidJS.

## SFC examples
Here are some examples for how Salad works.

1. Reactivity (Please note that this example does not work currently.)
```html
<script salad>
import { ref, reactive } from "salad-utils";

const counter = ref(0); // mutate counter.value to update state, read from counter.value to get the current value
</script>

<template>
  {{ counter }}
  <!-- event handler names are the same as they are in Solid -->
  <button @onClick="counter++">increment</button>
</template>
```
Reactivity in Salad is primarily done with `ref()` and `reactive()` from the `@uwu/salad-utils` package. They function similarly to the functions with the same name in Vue work, so I will link to the [Vue docs](https://vuejs.org/api/reactivity-utilities.html).

2. Running code outside of your component
```html
<!-- script tags without the salad attribute will be ran outside of your component and can do exports (besides default exports) -->
<script>
export let value = "x";
</script>

<template>
    <!-- templates can still reference values inside of normal script tags -->
  {{ value }}
</template>
```

3. Using Solid's primitives instead of Salad's
```html
<!-- Salad does not prevent you from using any Solid primitives -->
<script salad>
import { createSignal } from "solid-js";

const [count, setCount] = createSignal(0);
</script>

<template>
  {{ count() }}
  <button @onClick="setCount(count() + 1)">increment</button>
</template>
```

4. Dynamically binding attributes
```html
<script salad>
const imageSrc = "https://raw.githubusercontent.com/solidjs/solid/main/banner.png";
const key = "disabled";
const value = true;
</script>

<template>
  <img :src="imageSrc" />
  <button :[key]="value">click me</button>
</template>
```