import { Language } from "voynich-ipsum"

(() => {
  const bind = (id: string, cb: VoidFunction) =>
    ((document.getElementById(id) as HTMLInputElement).onclick = cb)
  // code for the language column
  let seed = 1
  let paragraphs: undefined | number
  let language = new Language({ seed })
  const setText = (id: string, text: string) => {
    let e = document.getElementById(id)
    if (e) e.innerHTML = text
  }
  const setName = () => setText("name", language.name)
  const setAssertion = () => setText("assertion", language.assertion())
  const setQuestion = () => setText("question", language.question())
  const setExclamation = () => setText("exclamation", language.exclamation())
  const setEssay = () => setText("essay", language.essay(paragraphs))
  const setAll = () => {
    setName()
    setAssertion()
    setQuestion()
    setExclamation()
    setEssay()
  }
  const setSeed = () => {
    let input = document.getElementById("seed") as HTMLInputElement
    if (input.value) {
      seed = Number.parseFloat(input.value)
      language = new Language({ seed })
      setAll()
    }
  }
  setAll()
  bind("change-seed", setSeed)
  bind("assertion-again", setAssertion)
  bind("question-again", setQuestion)
  bind("exclamation-again", setExclamation)
  bind("essay-again", setEssay)
  // code for the language picker column
  const pageSize = 15
  let page = 0
  const seedChanged = () => {
    (document.getElementById("seed") as HTMLInputElement).value =
      seed.toString()
    language = new Language({ seed })
    setAll()
  }
  const changePage = (dir: 1 | -1) => {
    page = page + dir
    seed = page * pageSize + 1
    seedChanged()
    populatePicker()
  }
  const picker = document.getElementById("language-picker") as HTMLDivElement
  const populatePicker = () => {
    while (picker.firstChild) picker.removeChild(picker.firstChild)
    for (let i = 0; i < pageSize; i++) {
      const s = seed + i
      const lang = new Language({ seed: s })
      const selection = document.createElement("DIV")
      selection.setAttribute("class", "lang")
      selection.innerHTML = lang.name
      picker.appendChild(selection)
      selection.onclick = () => {
        seed = s
        seedChanged()
      }
    }
  }
  populatePicker()
  for (const n of document.getElementsByClassName("left")) {
    (n as HTMLDivElement).onclick = () => changePage(-1)
  }
  for (const n of document.getElementsByClassName("right")) {
    (n as HTMLDivElement).onclick = () => changePage(1)
  }
})()
