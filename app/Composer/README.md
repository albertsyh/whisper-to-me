@startuml

[*] --> Start
Start --> Paused
Paused --> onTranscribe
onTranscribe --> Start
onTranscribe --> [*]


Start --> Stop
Stop --> onFinalTranscribe
onFinalTranscribe --> [*]

@enduml
