window.AGENDA_CONFIG = {
  storageKey: "agenda-examenes-v7",
  subjects: [
    "Castellano",
    "Tecnología",
    "Dibujo Técnico",
    "Inglés",
    "Matemáticas",
    "Física y Química",
    "Catalán",
    "Repaso general"
  ],
  weeks: [
    {
      label: "Semana 1",
      range: "18 al 24 de mayo",
      days: [
        { day: 18, weekday: "Lunes", exams: [] },
        { day: 19, weekday: "Martes", exams: [] },
        { day: 20, weekday: "Miércoles", exams: [] },
        { day: 21, weekday: "Jueves", exams: [{ name: "Castellano", icon: "ti-book" }] },
        { day: 22, weekday: "Viernes", exams: [{ name: "Tecnología", icon: "ti-cpu" }] },
        { day: 23, weekday: "Sábado", exams: [] },
        { day: 24, weekday: "Domingo", exams: [] }
      ]
    },
    {
      label: "Semana 2",
      range: "25 al 31 de mayo",
      days: [
        { day: 25, weekday: "Lunes", exams: [{ name: "Dibujo Técnico", icon: "ti-ruler-2" }, { name: "Inglés", icon: "ti-language" }] },
        { day: 26, weekday: "Martes", exams: [{ name: "Matemáticas", icon: "ti-math-function" }, { name: "Física y Química", icon: "ti-flask" }] },
        { day: 27, weekday: "Miércoles", exams: [] },
        { day: 28, weekday: "Jueves", exams: [{ name: "Catalán", icon: "ti-language" }] },
        { day: 29, weekday: "Viernes", exams: [] },
        { day: 30, weekday: "Sábado", exams: [] },
        { day: 31, weekday: "Domingo", exams: [] }
      ]
    }
  ]
};
