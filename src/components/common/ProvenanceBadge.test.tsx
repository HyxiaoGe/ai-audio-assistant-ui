import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { ProvenanceBadge } from "@/components/common/ProvenanceBadge"

describe("ProvenanceBadge", () => {
  it("renders the label text", () => {
    render(<ProvenanceBadge label="Gemini 3 Pro" />)
    expect(screen.getByText("Gemini 3 Pro")).toBeInTheDocument()
  })

  it("renders nothing when label is null (NULL 不显示徽章)", () => {
    const { container } = render(<ProvenanceBadge label={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when label is empty string", () => {
    const { container } = render(<ProvenanceBadge label="" tooltip="x" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("exposes the detail as an accessible label (for hover tooltip + screen readers)", () => {
    render(<ProvenanceBadge label="Gemini 3 Pro" tooltip="google/gemini-3-pro-image-preview" />)
    expect(screen.getByLabelText("google/gemini-3-pro-image-preview")).toBeInTheDocument()
  })

  it("falls back to the label as accessible name when no tooltip given", () => {
    render(<ProvenanceBadge label="腾讯云" />)
    expect(screen.getByLabelText("腾讯云")).toBeInTheDocument()
  })
})
