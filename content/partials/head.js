// Runs first, in <head>: a page opened at #section must not smooth-scroll through everything above it.
if (location.hash) document.documentElement.style.scrollBehavior = "auto";
