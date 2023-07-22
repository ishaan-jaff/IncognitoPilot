import { Message } from "@/llm/base";
import { chatCall, Interpreter } from "@/app/api_calls";
import { Approver } from "@/app/approver";


// TODO: Faster way of setting constructor in typescript?
export class ChatRound {
  private _history: Message[]
  private readonly _setHistory: (message: Message[]) => void
  private readonly _approverIn: Approver
  private readonly _approverOut: Approver
  private readonly _interpreter: Interpreter
  private readonly _doneCallback: () => void

  constructor(
    history: Message[],
    setHistory: (message: Message[]) => void,
    approverIn: Approver,
    approverOut: Approver,
    interpreter: Interpreter,
    doneCallback: () => void
  ) {
    this._history = history
    this._setHistory = setHistory
    this._approverIn = approverIn
    this._approverOut = approverOut
    this._interpreter = interpreter
    this._doneCallback = doneCallback
  }

  private extendHistory(message: Message) {
    const newHistory = [...this._history, message]
    this._setHistory(newHistory)
    this._history = newHistory
    return newHistory
  }

  start = (message: string) => {
    const newMessage: Message = { role: "user", text: message }
    const newHistory = this.extendHistory(newMessage)
    chatCall(newHistory).then(this.onModelMessage)
  }

  private onModelMessage = (message: Message) => {
    this.extendHistory(message)
    if(message.code !== undefined) {
      this._approverIn.whenApproved(message.code).then(() => {
        this.executeCode(message.code ?? "")
      })
    }
    else {
      this._doneCallback()
    }
  }

  private executeCode = (code: string) => {
    this._interpreter.run(code).then(result => {
      this._approverOut.whenApproved(result).then(() => {
        this.executeCodeDone(result)
      })
    })
  }

  private executeCodeDone = (result: string) => {
    const newMessage: Message = { role: "interpreter", code_result: result }
    const newHistory = this.extendHistory(newMessage)
    chatCall(newHistory).then(this.onModelMessage)
  }

}