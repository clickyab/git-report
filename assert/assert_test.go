package assert

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestSpec(t *testing.T) {
	Convey("test for assert functions", t, func() {
		So(func() { Nil("panic") }, ShouldPanic)
		So(func() { Nil(nil) }, ShouldNotPanic)

		So(func() { NotNil(nil) }, ShouldPanic)
		So(func() { NotNil("ha?") }, ShouldNotPanic)

		So(func() { True(true) }, ShouldNotPanic)
		So(func() { True(false) }, ShouldPanic)

		So(func() { False(false) }, ShouldNotPanic)
		So(func() { False(true) }, ShouldPanic)

		So(func() { Empty("") }, ShouldNotPanic)
		So(func() { Empty("Not empty") }, ShouldPanic)
	})
}
