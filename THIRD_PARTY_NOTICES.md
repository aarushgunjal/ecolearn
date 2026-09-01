# EcoLearn Third-Party Notices

Last reviewed: August 31, 2026

EcoLearn is proprietary software. The notices below apply only to the identified third-party components and resources; they do not grant a license to EcoLearn's own code, branding, content, or artwork.

## Included open-source software

The production applications include the following direct dependencies. Their transitive dependencies retain their own copyright and license notices in the respective source distributions.

| Component | Version in audited install | Use | License | Source |
| --- | ---: | --- | --- | --- |
| React / React DOM | 18.3.1 web; React 19.2.3 mobile | User interface | MIT | https://github.com/facebook/react |
| React Native | 0.86.3 | Native mobile runtime | MIT | https://github.com/facebook/react-native |
| Expo and Expo modules | 57.x | Mobile runtime and native modules | MIT | https://github.com/expo/expo |
| Expo Vector Icons | 15.1.1 | Mobile icons and bundled icon fonts | MIT; individual icon families may carry their upstream licenses | https://github.com/expo/vector-icons |
| React Native Async Storage | 2.2.0 | Local mobile session storage | MIT | https://github.com/react-native-async-storage/async-storage |
| React Native Maps | 1.27.2 | Native map presentation | MIT | https://github.com/react-native-maps/react-native-maps |
| Supabase JavaScript | 2.108.2 web; 2.111.0 mobile | Authentication, database, storage, functions | MIT | https://github.com/supabase/supabase-js |
| Radix UI Slot / Toast | 1.3.0 / 1.2.17 | Web interface primitives | MIT | https://github.com/radix-ui/primitives |
| class-variance-authority | 0.7.1 | Web style variants | Apache-2.0 | https://github.com/joe-bell/cva |
| clsx | 2.1.1 | Web class-name utility | MIT | https://github.com/lukeed/clsx |
| Leaflet | 1.9.4 | Interactive web maps | BSD-2-Clause | https://github.com/Leaflet/Leaflet |
| Lucide React | 0.462.0 | Web icons | ISC | https://github.com/lucide-icons/lucide |
| tailwind-merge | 2.6.1 | Web class-name utility | MIT | https://github.com/dcastil/tailwind-merge |
| react-native-url-polyfill | 4.0.0 | Mobile URL compatibility | MIT | https://github.com/charpeni/react-native-url-polyfill |

### MIT License

Copyright (c) the respective component authors and contributors.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Expo is copyright (c) 2015-present 650 Industries, Inc. (aka Expo) and is distributed under the MIT License above.

### Leaflet — BSD 2-Clause License

Copyright (c) 2010-2026, Vladimir Agafonkin. Copyright (c) 2010-2011, CloudMade. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

### Lucide — ISC License

Copyright (c) 2020, Lucide Contributors.

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

### class-variance-authority — Apache License 2.0

Licensed under the Apache License, Version 2.0. A copy is available at https://www.apache.org/licenses/LICENSE-2.0. The audited package did not contain an upstream `NOTICE` file requiring additional reproduction.

## Data and service attributions

- Map data: © OpenStreetMap contributors, licensed under the Open Data Commons Open Database License (ODbL), https://www.openstreetmap.org/copyright. The web map displays this attribution on the map.
- Product information: Open Food Facts. Database content is made available under the ODbL; individual contents and images may have additional terms. EcoLearn's current barcode response does not redistribute product images. See https://world.openfoodfacts.org/terms-of-use.
- Delaware disposal guidance: Delaware Department of Natural Resources and Environmental Control (DNREC) Recyclopedia, https://dnrec.delaware.gov/waste-hazardous/recycling/what/. Source links are displayed with results. Ownership and reuse permission remain with the source.
- Delaware educational videos and facility information: Delaware Solid Waste Authority (DSWA), https://dswaeducation.com/videos/ and https://dswa.com/facility/. Videos are linked or embedded from their official hosting pages; DSWA retains ownership.
- YouTube: embedded videos use YouTube's privacy-enhanced player and remain subject to YouTube's terms.

## Material transitive-license notes

- `lightningcss` 1.33.0 and its optional platform packages are MPL-2.0 and are used through Expo's Metro build tooling. EcoLearn does not modify or redistribute their source as part of its application code. If a modified MPL-covered file is ever distributed, the modified file's source and notices must be made available under MPL-2.0.
- `node-forge` 1.4.0 is dual-licensed BSD-3-Clause OR GPL-2.0 and is used by Expo CLI code-signing tools. EcoLearn elects the permissive BSD-3-Clause option; the GPL option is not used.
- `caniuse-lite` 1.0.30001806 is CC-BY-4.0 browser-compatibility data used by build tooling. Its attribution is preserved here and in its package metadata.
- `argparse` 2.0.1 (Python-2.0 license), `big-integer` 1.6.52 and `stream-buffers` 2.2.0 (Unlicense), and `fb-dotslash` 0.5.8 (MIT OR Apache-2.0) are transitive Expo tooling dependencies. No reciprocal source-disclosure obligation was identified for EcoLearn.

No AGPL, GPL-only, LGPL, SSPL, Commons Clause, Business Source License, Elastic License, or non-commercial package was found in the audited production dependency trees.
