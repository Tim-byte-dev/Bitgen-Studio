# Security

bitGen Studio is a **local** application. Its server listens on `127.0.0.1` (this computer) unless you turn on the phone
remote link, which only allows your own network. The Unreal bridge plugin also listens on `127.0.0.1` only.

If you find a way for another computer to reach the studio, run code through it or read your files, please **do not
open a public issue**. Report it privately through GitHub's *Report a vulnerability* (the Security tab of this
repository), and include the version and the steps to reproduce it. We will reply within a week.

Never post your `custom.settings`: it can hold your Hugging Face token and your folder paths.
