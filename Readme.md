# meds

meds is a fork of [reds](https://github.com/visionmedia/reds) with MongoDB
support (rather than Redis as in reds). Please see the
[reds documentation](https://github.com/visionmedia/reds) for API details. The
only difference between reds and meds is meds needs a `process.env.MONGO_URL`.
And the name is meds.

## Installation

  $ npm install meds

## Benchmarks

Quoting reds' README: "Nothing scientific but"...

### Reds

```console
➜ reds git:(master) ✗ make test # 1000 cycles

  tests completed in 2601ms

➜ reds git:(master) ✗ make test # 10000 cycles

  tests completed in 24396ms

➜ reds git:(master) ✗ make bench # large is 10x medium

                      indexing
             140 op/s » tiny
              31 op/s » small
               6 op/s » medium
               1 op/s » large


  Suites:  1
  Benches: 4
  Elapsed: 150,642.04 ms
```

### Meds

```console
➜ meds git:(feature/mongodb) ✗ make test  # 1000 cycles

  tests completed in 3790ms

➜ meds git:(feature/mongodb) ✗ make test  # 10000 cycles

  tests completed in 33805ms

➜ meds git:(feature/mongodb) ✗ make bench # large is 10x medium

                      indexing
             135 op/s » tiny
              37 op/s » small
               6 op/s » medium
               1 op/s » large


  Suites:  1
  Benches: 4
  Elapsed: 148,342.29 ms
```

## License 

(The MIT License)

Copyright (c) 2011 TJ Holowaychuk &lt;tj@vision-media.ca&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
